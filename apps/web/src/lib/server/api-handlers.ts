import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gt,
  inArray,
  isNull,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { alias } from "drizzle-orm/sqlite-core";
import { z } from "zod";

import type { Database } from "@/db/client";
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
  academicTerm,
  accessGroup,
  accessGroupRole,
  accessPermission,
  accessRole,
  accessRolePermission,
  auditEvent,
  healthDiagnosis,
  healthMedicalAdvance,
  healthMedicalAdvanceDetail,
  healthMedicalSettlement,
  healthTbCase,
  healthTbDetail,
  healthVisit,
  houseMaster,
  markSheet,
  organization,
  organizationInvitation,
  organizationMember,
  person,
  personAcademicRecord,
  personFamilyProfile,
  personFile,
  personPlacement,
  personRelationship,
  schoolClassOffering,
  schoolHouseMaster,
  schoolMaster,
  scholarshipAnnualDetail,
  scholarshipCityAdvance,
  scholarshipCourse,
  scholarshipCourseCategory,
  scholarshipHead,
  scholarshipLimit,
  scholarshipRecord,
  scholarshipSanction,
  scholarshipSanctionLine,
  sponsorshipAssignment,
  sponsorshipCorrespondenceType,
  sponsorshipFund,
  sponsorshipFundAllocation,
  sponsorshipFundType,
  sponsorshipIndividual,
  sponsorshipLetter,
  sponsorshipOrganization,
  sponsorshipSponsorCategory,
  sponsorshipSponsorType,
  sponsorshipStatus,
  sponsorshipVisitor,
  sponsorshipVisitorType,
  staffCategory,
  staffDepartment,
  staffDesignation,
  staffProfile,
  studentEnrollment,
  studentEnrollmentChange,
  studentMark,
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
import { sendPasswordResetEmail } from "@/lib/auth-email";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { findDashboard } from "@/lib/server/repositories/dashboard-repository";
import { findPeopleRegistry } from "@/lib/server/repositories/people-repository";
import { findStaffDirectory } from "@/lib/server/repositories/staff-repository";
import { allocationsFitFund, sponsorshipDisplayName } from "@/lib/sponsorship";

const preferenceSchema = z.object({
  academicSessionId: z.string().uuid(),
});

const organizationSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100),
  displayTitle: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .transform((value) => value || null),
  timezone: z.string().trim().min(1).max(64),
  locale: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
});

const dashboardQuerySchema = z.object({
  sessionId: z.uuid(),
});

const reportExportAuditSchema = z.object({
  domain: z.enum(["scholarship", "sponsorship"]),
  report: z.string().trim().min(1).max(80),
  session: z.string().trim().min(1).max(80),
  format: z.enum(["csv", "pdf"]),
  rowCount: z.number().int().min(0),
});

const auditQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  action: z.string().trim().max(120).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const academicSessionSettingsSchema = z.object({
  name: z.string().trim().min(2).max(40),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  isActive: z.boolean().default(true),
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

const staffQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["all", "active", "inactive"]).default("all"),
  department: z.string().trim().max(80).default("all"),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
});

const staffNullableText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .nullable()
    .optional()
    .transform((value) => value || null);

const staffProfileSchema = z.object({
  status: z.enum(["active", "inactive"]),
  departmentId: z.uuid().nullable(),
  designationId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  joinedOn: z.iso.date().nullable(),
  permanentOn: z.iso.date().nullable(),
  location: staffNullableText(160),
  phone: staffNullableText(80),
  email: z.union([z.email(), z.literal(""), z.null()]).transform((value) => value || null),
  address: staffNullableText(1_000),
  maritalStatus: staffNullableText(80),
  spouseName: staffNullableText(160),
  settlementName: staffNullableText(160),
  allocatedPlace: staffNullableText(160),
  registrationCertificateNumber: staffNullableText(100),
  panNumber: staffNullableText(100),
  quarterNumber: staffNullableText(100),
  nominee: staffNullableText(160),
  birthPlace: staffNullableText(160),
  city: staffNullableText(120),
  region: staffNullableText(120),
  country: staffNullableText(120),
  identityCardNumber: staffNullableText(100),
  greenBookNumber: staffNullableText(100),
  remarks: staffNullableText(2_000),
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
  educationNumber: z.string().trim().max(100).optional(),
  registrationCertificateNumber: z.string().trim().max(100).optional(),
  identityCertificateNumber: z.string().trim().max(100).optional(),
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
  educationNumber: nullablePersonText(100),
  registrationCertificateNumber: nullablePersonText(100),
  identityCertificateNumber: nullablePersonText(100),
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

function classDisplayName() {
  return sql<string>`case
    when lower(trim(coalesce(${academicClassMaster.section}, ''))) not in ('', 'none', '0', 'n/a', 'null')
      and lower(replace(replace(trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name})), '''', ''), '"', ''))
        not like '% ' || lower(trim(${academicClassMaster.section}))
    then trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name})) || ' ' || trim(${academicClassMaster.section})
    else trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name}))
  end`;
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
  activeSessionId: string | null;
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

    if (url.pathname === "/api/dashboard") {
      return getDashboard(request);
    }

    if (url.pathname === "/api/reports/exports") {
      return recordReportExport(request);
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

    const staffProfileMatch = url.pathname.match(/^\/api\/staff\/([^/]+)$/);
    if (staffProfileMatch) {
      return updateStaffProfile(request, staffProfileMatch[1]);
    }

    if (url.pathname === "/api/staff") {
      return getStaffDirectory(request);
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

    if (url.pathname === "/api/organization/audit") {
      return getOrganizationAudit(request);
    }

    if (url.pathname === "/api/organization/logo") {
      return handleOrganizationLogo(request);
    }

    if (url.pathname === "/api/organization/sessions") {
      return handleOrganizationSessions(request);
    }

    const organizationSessionMatch = url.pathname.match(/^\/api\/organization\/sessions\/([^/]+)$/);
    if (organizationSessionMatch) {
      return updateOrganizationSession(request, organizationSessionMatch[1]);
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

export async function handleApiRequest({ request }: { request: Request }): Promise<Response> {
  const startedAt = performance.now();
  const response = await apiDispatcher.fetch(request);
  const durationMs = performance.now() - startedAt;
  if (durationMs >= 500) {
    console.warn(
      JSON.stringify({
        event: "slow_api",
        method: request.method,
        path: new URL(request.url).pathname,
        status: response.status,
        durationMs: Number(durationMs.toFixed(1)),
      }),
    );
  }
  const headers = new Headers(response.headers);
  headers.set("Server-Timing", `app;dur=${durationMs.toFixed(1)}`);
  headers.set("X-Tsewa-Api-Ms", durationMs.toFixed(1));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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
    appName: runtime.APP_NAME,
    database: runtime.DB,
    secret: runtime.BETTER_AUTH_SECRET,
    baseURL: new URL(request.url).origin,
    allowSignUp,
    sendPasswordReset: (input) => sendPasswordResetEmail(runtime, input),
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
  const className = classDisplayName();
  const enrollmentScope = and(
    eq(studentEnrollment.organizationId, scope.organizationId),
    eq(studentEnrollment.academicSessionId, scope.session.id),
  );
  const [summaryRows, schools, classes, houses] = await runtime.ORM.batch([
    runtime.ORM.select({
      students: count(),
      activeStudents: sql<number>`sum(case when ${person.status} = 'active' then 1 else 0 end)`,
      inactiveStudents: sql<number>`sum(case when ${person.status} = 'inactive' then 1 else 0 end)`,
      schools: sql<number>`count(distinct ${studentEnrollment.schoolId})`,
      classes: sql<number>`count(distinct coalesce(${studentEnrollment.schoolId}, 'unmapped') || '|' || ${className})`,
      houses: sql<number>`count(distinct ${studentEnrollment.houseId})`,
      unmappedSchools: sql<number>`sum(case when ${studentEnrollment.schoolId} is null then 1 else 0 end)`,
    })
      .from(studentEnrollment)
      .innerJoin(
        person,
        and(
          eq(person.id, studentEnrollment.personId),
          eq(person.organizationId, studentEnrollment.organizationId),
        ),
      )
      .innerJoin(
        academicClassMaster,
        and(
          eq(academicClassMaster.id, studentEnrollment.academicClassId),
          eq(academicClassMaster.organizationId, studentEnrollment.organizationId),
        ),
      )
      .where(enrollmentScope),
    runtime.ORM.select({
      id: sql<string>`coalesce(${schoolMaster.id}, 'unmapped')`,
      name: sql<string>`coalesce(${schoolMaster.name}, 'School not set')`,
      count: count(),
    })
      .from(studentEnrollment)
      .leftJoin(
        schoolMaster,
        and(
          eq(schoolMaster.id, studentEnrollment.schoolId),
          eq(schoolMaster.organizationId, studentEnrollment.organizationId),
        ),
      )
      .where(enrollmentScope)
      .groupBy(schoolMaster.id, schoolMaster.name)
      .orderBy(desc(count()), sql`coalesce(${schoolMaster.name}, 'School not set') collate nocase`),
    runtime.ORM.select({ id: className, name: className, count: count() })
      .from(studentEnrollment)
      .innerJoin(
        academicClassMaster,
        and(
          eq(academicClassMaster.id, studentEnrollment.academicClassId),
          eq(academicClassMaster.organizationId, studentEnrollment.organizationId),
        ),
      )
      .where(enrollmentScope)
      .groupBy(className)
      .orderBy(
        sql`coalesce(max(${academicClassMaster.level}), 999)`,
        sql`${className} collate nocase`,
      ),
    runtime.ORM.select({
      id: sql<string>`coalesce(${houseMaster.id}, 'none')`,
      name: sql<string>`coalesce(${houseMaster.name}, 'No house')`,
      count: count(),
    })
      .from(studentEnrollment)
      .leftJoin(
        houseMaster,
        and(
          eq(houseMaster.id, studentEnrollment.houseId),
          eq(houseMaster.organizationId, studentEnrollment.organizationId),
        ),
      )
      .where(enrollmentScope)
      .groupBy(houseMaster.id, houseMaster.name)
      .orderBy(desc(count()), sql`coalesce(${houseMaster.name}, 'No house') collate nocase`),
  ]);
  const summary = summaryRows[0];

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
      schools,
      classes,
      houses,
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
  const [schools, classes, houses] = await runtime.ORM.batch([
    runtime.ORM.select({ id: schoolMaster.id, name: schoolMaster.name })
      .from(schoolMaster)
      .where(
        and(eq(schoolMaster.organizationId, scope.organizationId), eq(schoolMaster.isActive, 1)),
      )
      .orderBy(asc(sql`lower(${schoolMaster.name})`)),
    runtime.ORM.select({
      id: academicClassMaster.id,
      name: sql<string>`CASE
        WHEN lower(trim(coalesce(${academicClassMaster.section}, ''))) NOT IN ('', 'none', '0', 'n/a', 'null')
          AND lower(trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name})))
            NOT LIKE '% ' || lower(trim(${academicClassMaster.section}))
        THEN trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name})) || ' ' || trim(${academicClassMaster.section})
        ELSE trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name}))
      END`,
      schoolId: schoolClassOffering.schoolId,
    })
      .from(schoolClassOffering)
      .innerJoin(
        academicClassMaster,
        and(
          eq(academicClassMaster.id, schoolClassOffering.academicClassId),
          eq(academicClassMaster.organizationId, schoolClassOffering.organizationId),
        ),
      )
      .where(
        and(
          eq(schoolClassOffering.organizationId, scope.organizationId),
          eq(schoolClassOffering.academicSessionId, scope.session.id),
          eq(schoolClassOffering.isActive, 1),
          eq(academicClassMaster.isActive, 1),
        ),
      )
      .orderBy(
        asc(schoolClassOffering.schoolId),
        asc(sql`coalesce(${academicClassMaster.sortOrder}, 999)`),
        asc(sql`coalesce(${academicClassMaster.level}, 999)`),
        asc(sql`lower(${academicClassMaster.name})`),
      ),
    runtime.ORM.select({
      id: houseMaster.id,
      name: houseMaster.name,
      schoolId: schoolHouseMaster.schoolId,
    })
      .from(schoolHouseMaster)
      .innerJoin(
        houseMaster,
        and(
          eq(houseMaster.id, schoolHouseMaster.houseId),
          eq(houseMaster.organizationId, schoolHouseMaster.organizationId),
        ),
      )
      .where(
        and(
          eq(schoolHouseMaster.organizationId, scope.organizationId),
          eq(houseMaster.isActive, 1),
        ),
      )
      .orderBy(asc(schoolHouseMaster.schoolId), asc(sql`lower(${houseMaster.name})`)),
  ]);

  return Response.json({
    canEdit: hasPermission(scope, "school.enrollment.manage"),
    session: scope.session,
    schools,
    classes,
    houses,
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
    runtime.ORM.select({ id: schoolMaster.id, name: schoolMaster.name })
      .from(schoolMaster)
      .where(
        and(
          eq(schoolMaster.id, schoolId),
          eq(schoolMaster.organizationId, scope.organizationId),
          eq(schoolMaster.isActive, 1),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    runtime.ORM.select({ id: schoolClassOffering.id })
      .from(schoolClassOffering)
      .innerJoin(
        academicClassMaster,
        and(
          eq(academicClassMaster.id, schoolClassOffering.academicClassId),
          eq(academicClassMaster.organizationId, schoolClassOffering.organizationId),
        ),
      )
      .where(
        and(
          eq(schoolClassOffering.organizationId, scope.organizationId),
          eq(schoolClassOffering.academicSessionId, scope.session.id),
          eq(schoolClassOffering.schoolId, schoolId),
          eq(schoolClassOffering.academicClassId, academicClassId),
          eq(schoolClassOffering.isActive, 1),
          eq(academicClassMaster.isActive, 1),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    houseId
      ? runtime.ORM.select({ id: houseMaster.id })
          .from(schoolHouseMaster)
          .innerJoin(
            houseMaster,
            and(
              eq(houseMaster.id, schoolHouseMaster.houseId),
              eq(houseMaster.organizationId, schoolHouseMaster.organizationId),
            ),
          )
          .where(
            and(
              eq(schoolHouseMaster.organizationId, scope.organizationId),
              eq(schoolHouseMaster.schoolId, schoolId),
              eq(houseMaster.id, houseId),
              eq(houseMaster.isActive, 1),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    runtime.ORM.select({ id: person.id })
      .from(person)
      .where(
        and(
          eq(person.organizationId, scope.organizationId),
          eq(person.identifierKind, "admission"),
          eq(sql`lower(${person.primaryIdentifier})`, admissionNumber.toLowerCase()),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
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
  await runtime.ORM.batch([
    runtime.ORM.insert(person).values({
      id: personId,
      organizationId: scope.organizationId,
      kind: "child",
      status: "active",
      identifierKind: "admission",
      primaryIdentifier: admissionNumber,
      displayName,
      gender: parsed.data.gender ?? "unknown",
      dateOfBirth: parsed.data.dateOfBirth ?? null,
      educationNumber: parsed.data.educationNumber || null,
      registrationCertificateNumber: parsed.data.registrationCertificateNumber || null,
      identityCertificateNumber: parsed.data.identityCertificateNumber || null,
      admittedOrJoinedOn: admittedOn,
      campusOrLocation: school.name,
      sourceSystem: "tsewa",
      sourceTable: "person",
      sourceId: personId,
      createdByUserId: scope.userId,
      updatedByUserId: scope.userId,
    }),
    runtime.ORM.insert(studentEnrollment).values({
      id: enrollmentId,
      organizationId: scope.organizationId,
      personId,
      academicSessionId: scope.session.id,
      schoolId,
      academicClassId,
      houseId: houseId ?? null,
      schoolClassOfferingId: offering.id,
      status: "enrolled",
      statusSource: "explicit",
      startedOn: admittedOn,
      rollNumber: parsed.data.rollNumber || null,
      sourceSystem: "tsewa",
      sourceTable: "student_enrollment",
      sourceId: enrollmentId,
    }),
    runtime.ORM.insert(studentEnrollmentChange).values({
      id: changeId,
      organizationId: scope.organizationId,
      enrollmentId,
      personId,
      academicSessionId: scope.session.id,
      changeType: "admitted",
      effectiveOn: admittedOn,
      toSchoolId: schoolId,
      toAcademicClassId: academicClassId,
      toHouseId: houseId ?? null,
      toStatus: "enrolled",
      toRollNumber: parsed.data.rollNumber || null,
      createdByUserId: scope.userId,
    }),
    auditInsert(runtime.ORM, scope, "student.admitted", "person", personId, {
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
  const enrollment = await readStudentEnrollment(runtime.ORM, context.organizationId, enrollmentId);
  if (!enrollment) return Response.json({ error: "Enrollment not found." }, { status: 404 });

  const fromSchool = alias(schoolMaster, "from_school");
  const toSchool = alias(schoolMaster, "to_school");
  const fromClass = alias(academicClassMaster, "from_class");
  const toClass = alias(academicClassMaster, "to_class");
  const fromHouse = alias(houseMaster, "from_house");
  const toHouse = alias(houseMaster, "to_house");
  const actor = alias(user, "actor");
  const [schools, classes, houses, changes] = await Promise.all([
    runtime.ORM.select({ id: schoolMaster.id, name: schoolMaster.name })
      .from(schoolMaster)
      .where(
        and(eq(schoolMaster.organizationId, context.organizationId), eq(schoolMaster.isActive, 1)),
      )
      .orderBy(asc(sql`lower(${schoolMaster.name})`)),
    runtime.ORM.select({
      id: academicClassMaster.id,
      name: sql<string>`CASE
        WHEN lower(trim(coalesce(${academicClassMaster.section}, ''))) NOT IN ('', 'none', '0', 'n/a', 'null')
          AND lower(trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name})))
            NOT LIKE '% ' || lower(trim(${academicClassMaster.section}))
        THEN trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name})) || ' ' || trim(${academicClassMaster.section})
        ELSE trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name}))
      END`,
      schoolId: schoolClassOffering.schoolId,
    })
      .from(schoolClassOffering)
      .innerJoin(
        academicClassMaster,
        and(
          eq(academicClassMaster.id, schoolClassOffering.academicClassId),
          eq(academicClassMaster.organizationId, schoolClassOffering.organizationId),
        ),
      )
      .where(
        and(
          eq(schoolClassOffering.organizationId, context.organizationId),
          eq(schoolClassOffering.academicSessionId, enrollment.academicSessionId),
          eq(schoolClassOffering.isActive, 1),
          eq(academicClassMaster.isActive, 1),
        ),
      )
      .orderBy(
        asc(schoolClassOffering.schoolId),
        asc(sql`coalesce(${academicClassMaster.sortOrder}, 999)`),
        asc(sql`coalesce(${academicClassMaster.level}, 999)`),
        asc(sql`lower(${academicClassMaster.name})`),
      ),
    runtime.ORM.select({
      id: houseMaster.id,
      name: houseMaster.name,
      schoolId: schoolHouseMaster.schoolId,
    })
      .from(schoolHouseMaster)
      .innerJoin(
        houseMaster,
        and(
          eq(houseMaster.id, schoolHouseMaster.houseId),
          eq(houseMaster.organizationId, schoolHouseMaster.organizationId),
        ),
      )
      .where(
        and(
          eq(schoolHouseMaster.organizationId, context.organizationId),
          eq(houseMaster.isActive, 1),
        ),
      )
      .orderBy(asc(schoolHouseMaster.schoolId), asc(sql`lower(${houseMaster.name})`)),
    runtime.ORM.select({
      id: studentEnrollmentChange.id,
      changeType: studentEnrollmentChange.changeType,
      effectiveOn: studentEnrollmentChange.effectiveOn,
      fromStatus: studentEnrollmentChange.fromStatus,
      toStatus: studentEnrollmentChange.toStatus,
      note: studentEnrollmentChange.note,
      createdAt: studentEnrollmentChange.createdAt,
      fromSchoolName: fromSchool.name,
      toSchoolName: toSchool.name,
      fromClassName: sql<
        string | null
      >`CASE WHEN ${fromClass.id} IS NULL THEN NULL ELSE trim(coalesce(nullif(${fromClass.title}, ''), ${fromClass.name})) || CASE WHEN trim(coalesce(${fromClass.section}, '')) = '' THEN '' ELSE ' ' || trim(${fromClass.section}) END END`,
      toClassName: sql<
        string | null
      >`CASE WHEN ${toClass.id} IS NULL THEN NULL ELSE trim(coalesce(nullif(${toClass.title}, ''), ${toClass.name})) || CASE WHEN trim(coalesce(${toClass.section}, '')) = '' THEN '' ELSE ' ' || trim(${toClass.section}) END END`,
      fromHouseName: fromHouse.name,
      toHouseName: toHouse.name,
      fromRollNumber: studentEnrollmentChange.fromRollNumber,
      toRollNumber: studentEnrollmentChange.toRollNumber,
      changedBy: actor.name,
    })
      .from(studentEnrollmentChange)
      .leftJoin(fromSchool, eq(fromSchool.id, studentEnrollmentChange.fromSchoolId))
      .leftJoin(toSchool, eq(toSchool.id, studentEnrollmentChange.toSchoolId))
      .leftJoin(fromClass, eq(fromClass.id, studentEnrollmentChange.fromAcademicClassId))
      .leftJoin(toClass, eq(toClass.id, studentEnrollmentChange.toAcademicClassId))
      .leftJoin(fromHouse, eq(fromHouse.id, studentEnrollmentChange.fromHouseId))
      .leftJoin(toHouse, eq(toHouse.id, studentEnrollmentChange.toHouseId))
      .leftJoin(actor, eq(actor.id, studentEnrollmentChange.createdByUserId))
      .where(
        and(
          eq(studentEnrollmentChange.organizationId, context.organizationId),
          eq(studentEnrollmentChange.enrollmentId, enrollmentId),
        ),
      )
      .orderBy(desc(studentEnrollmentChange.effectiveOn), desc(studentEnrollmentChange.createdAt)),
  ]);

  const classOptions = [...classes];
  if (!classOptions.some((item) => item.id === enrollment.academicClassId)) {
    classOptions.push({
      id: enrollment.academicClassId,
      name: enrollment.className,
      schoolId: enrollment.schoolId ?? "",
    });
  }
  const houseOptions = [...houses];
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
      schools,
      classes: classOptions,
      houses: houseOptions,
    },
    changes,
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
  const enrollment = await readStudentEnrollment(runtime.ORM, context.organizationId, enrollmentId);
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
      runtime.ORM.select({ id: schoolMaster.id })
        .from(schoolMaster)
        .where(
          and(
            eq(schoolMaster.id, targetSchoolId),
            eq(schoolMaster.organizationId, context.organizationId),
            eq(schoolMaster.isActive, 1),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      runtime.ORM.select({ id: schoolClassOffering.id })
        .from(schoolClassOffering)
        .innerJoin(
          academicClassMaster,
          and(
            eq(academicClassMaster.id, schoolClassOffering.academicClassId),
            eq(academicClassMaster.organizationId, schoolClassOffering.organizationId),
          ),
        )
        .where(
          and(
            eq(schoolClassOffering.organizationId, context.organizationId),
            eq(schoolClassOffering.academicSessionId, enrollment.academicSessionId),
            eq(schoolClassOffering.schoolId, targetSchoolId),
            eq(schoolClassOffering.academicClassId, targetClassId),
            eq(schoolClassOffering.isActive, 1),
            eq(academicClassMaster.isActive, 1),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      targetHouseId
        ? runtime.ORM.select({ id: houseMaster.id })
            .from(schoolHouseMaster)
            .innerJoin(
              houseMaster,
              and(
                eq(houseMaster.id, schoolHouseMaster.houseId),
                eq(houseMaster.organizationId, schoolHouseMaster.organizationId),
              ),
            )
            .where(
              and(
                eq(schoolHouseMaster.organizationId, context.organizationId),
                eq(schoolHouseMaster.schoolId, targetSchoolId),
                eq(houseMaster.id, targetHouseId),
                eq(houseMaster.isActive, 1),
              ),
            )
            .limit(1)
            .then((rows) => rows[0] ?? null)
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
  const nextRollNumber = keepsStudentEnrolled
    ? parsed.data.rollNumber === undefined
      ? enrollment.rollNumber
      : parsed.data.rollNumber
    : enrollment.rollNumber;
  const personIdToDeactivate =
    !keepsStudentEnrolled && enrollment.academicSessionId === enrollment.latestSessionId
      ? enrollment.personId
      : "__no_person__";
  await runtime.ORM.batch([
    runtime.ORM.update(studentEnrollment)
      .set({
        schoolId: targetSchoolId,
        academicClassId: targetClassId,
        houseId: targetHouseId,
        schoolClassOfferingId: offeringId,
        status: nextStatus,
        statusSource: "explicit",
        endedOn: keepsStudentEnrolled ? null : parsed.data.effectiveOn,
        rollNumber: nextRollNumber,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(studentEnrollment.id, enrollmentId),
          eq(studentEnrollment.organizationId, context.organizationId),
          inArray(studentEnrollment.status, ["recorded", "enrolled"]),
        ),
      ),
    runtime.ORM.insert(studentEnrollmentChange).values({
      id: changeId,
      organizationId: context.organizationId,
      enrollmentId,
      personId: enrollment.personId,
      academicSessionId: enrollment.academicSessionId,
      changeType,
      effectiveOn: parsed.data.effectiveOn,
      fromSchoolId: enrollment.schoolId,
      toSchoolId: targetSchoolId,
      fromAcademicClassId: enrollment.academicClassId,
      toAcademicClassId: targetClassId,
      fromHouseId: enrollment.houseId,
      toHouseId: targetHouseId,
      fromStatus: enrollment.status,
      toStatus: nextStatus,
      fromRollNumber: enrollment.rollNumber,
      toRollNumber: nextRollNumber,
      note: parsed.data.note || null,
      createdByUserId: context.userId,
    }),
    runtime.ORM.update(person)
      .set({
        status: "inactive",
        updatedByUserId: context.userId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(eq(person.id, personIdToDeactivate), eq(person.organizationId, context.organizationId)),
      ),
    auditInsert(runtime.ORM, context, `student.${changeType}`, "student_enrollment", enrollmentId, {
      personId: enrollment.personId,
      effectiveOn: parsed.data.effectiveOn,
      fromStatus: enrollment.status,
      toStatus: nextStatus,
    }),
  ]);

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
    runtime.ORM,
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
  const existingChange = await runtime.ORM.select({
    id: studentEnrollmentChange.id,
    effectiveOn: studentEnrollmentChange.effectiveOn,
    note: studentEnrollmentChange.note,
  })
    .from(studentEnrollmentChange)
    .where(
      and(
        eq(studentEnrollmentChange.organizationId, context.organizationId),
        eq(studentEnrollmentChange.enrollmentId, parsedId.data),
        eq(studentEnrollmentChange.changeType, changeType),
      ),
    )
    .orderBy(desc(studentEnrollmentChange.createdAt))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  await runtime.ORM.update(studentEnrollment)
    .set({ endedOn: parsed.data.effectiveOn, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(
      and(
        eq(studentEnrollment.id, parsedId.data),
        eq(studentEnrollment.organizationId, context.organizationId),
      ),
    );

  if (existingChange) {
    await runtime.ORM.update(studentEnrollmentChange)
      .set({ effectiveOn: parsed.data.effectiveOn, note: parsed.data.reason })
      .where(
        and(
          eq(studentEnrollmentChange.id, existingChange.id),
          eq(studentEnrollmentChange.organizationId, context.organizationId),
        ),
      );
  } else {
    await runtime.ORM.insert(studentEnrollmentChange).values({
      id: crypto.randomUUID(),
      organizationId: context.organizationId,
      enrollmentId: parsedId.data,
      personId: enrollment.personId,
      academicSessionId: enrollment.academicSessionId,
      changeType,
      effectiveOn: parsed.data.effectiveOn,
      fromSchoolId: enrollment.schoolId,
      toSchoolId: enrollment.schoolId,
      fromAcademicClassId: enrollment.academicClassId,
      toAcademicClassId: enrollment.academicClassId,
      fromHouseId: enrollment.houseId,
      toHouseId: enrollment.houseId,
      fromStatus: "enrolled",
      toStatus: enrollment.status,
      fromRollNumber: enrollment.rollNumber,
      toRollNumber: enrollment.rollNumber,
      note: parsed.data.reason,
      createdByUserId: context.userId,
    });
  }

  await auditInsert(
    runtime.ORM,
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
  );

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
  database: Database,
  organizationId: string,
  enrollmentId: string,
): Promise<StudentEnrollmentRecord | null> {
  const enrollment = await database
    .select({
      id: studentEnrollment.id,
      personId: studentEnrollment.personId,
      displayName: person.displayName,
      admissionNumber: person.primaryIdentifier,
      academicSessionId: studentEnrollment.academicSessionId,
      sessionName: academicSession.name,
      sessionStartsOn: academicSession.startsOn,
      sessionEndsOn: academicSession.endsOn,
      latestSessionId: sql<string | null>`(
          SELECT latest.id
          FROM academic_session latest
          WHERE latest.organization_id = ${studentEnrollment.organizationId}
            AND latest.is_active = 1
          ORDER BY latest.starts_on DESC
          LIMIT 1
        )`,
      schoolId: studentEnrollment.schoolId,
      schoolName: schoolMaster.name,
      academicClassId: studentEnrollment.academicClassId,
      className: sql<string>`CASE
          WHEN lower(trim(coalesce(${academicClassMaster.section}, ''))) NOT IN ('', 'none', '0', 'n/a', 'null')
            AND lower(trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name})))
              NOT LIKE '% ' || lower(trim(${academicClassMaster.section}))
          THEN trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name})) || ' ' || trim(${academicClassMaster.section})
          ELSE trim(coalesce(nullif(${academicClassMaster.title}, ''), ${academicClassMaster.name}))
        END`,
      houseId: studentEnrollment.houseId,
      houseName: houseMaster.name,
      schoolClassOfferingId: studentEnrollment.schoolClassOfferingId,
      rollNumber: studentEnrollment.rollNumber,
      status: studentEnrollment.status,
      statusSource: studentEnrollment.statusSource,
      startedOn: studentEnrollment.startedOn,
      endedOn: studentEnrollment.endedOn,
    })
    .from(studentEnrollment)
    .innerJoin(
      person,
      and(
        eq(person.id, studentEnrollment.personId),
        eq(person.organizationId, studentEnrollment.organizationId),
      ),
    )
    .innerJoin(
      academicSession,
      and(
        eq(academicSession.id, studentEnrollment.academicSessionId),
        eq(academicSession.organizationId, studentEnrollment.organizationId),
      ),
    )
    .innerJoin(
      academicClassMaster,
      and(
        eq(academicClassMaster.id, studentEnrollment.academicClassId),
        eq(academicClassMaster.organizationId, studentEnrollment.organizationId),
      ),
    )
    .leftJoin(
      schoolMaster,
      and(
        eq(schoolMaster.id, studentEnrollment.schoolId),
        eq(schoolMaster.organizationId, studentEnrollment.organizationId),
      ),
    )
    .leftJoin(
      houseMaster,
      and(
        eq(houseMaster.id, studentEnrollment.houseId),
        eq(houseMaster.organizationId, studentEnrollment.organizationId),
      ),
    )
    .where(
      and(
        eq(studentEnrollment.id, enrollmentId),
        eq(studentEnrollment.organizationId, organizationId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!enrollment) return null;
  return {
    ...enrollment,
    latestSessionId: enrollment.latestSessionId ?? enrollment.academicSessionId,
    status: enrollment.status as StudentEnrollmentRecord["status"],
    statusSource: enrollment.statusSource as StudentEnrollmentRecord["statusSource"],
  };
}

type SchoolStudentFilters = z.infer<typeof schoolStudentFiltersSchema>;

function buildSchoolStudentFilters(
  scope: { organizationId: string; session: { id: string } },
  filters: SchoolStudentFilters,
) {
  const conditions = [
    eq(studentEnrollment.organizationId, scope.organizationId),
    eq(studentEnrollment.academicSessionId, scope.session.id),
    eq(person.organizationId, scope.organizationId),
  ];
  if (filters.q) {
    const search = `%${escapeLikePattern(filters.q.toLowerCase())}%`;
    conditions.push(
      or(
        sql`lower(${person.displayName}) like ${search} escape '\\'`,
        sql`lower(${person.primaryIdentifier}) like ${search} escape '\\'`,
        sql`lower(coalesce(${studentEnrollment.rollNumber}, '')) like ${search} escape '\\'`,
      )!,
    );
  }
  if (filters.school !== "all") {
    if (filters.school === "unmapped") {
      conditions.push(isNull(studentEnrollment.schoolId));
    } else {
      conditions.push(eq(schoolMaster.id, filters.school));
    }
  }
  if (filters.className !== "all") {
    conditions.push(eq(classDisplayName(), filters.className));
  }
  if (filters.house !== "all") {
    if (filters.house === "none") {
      conditions.push(isNull(studentEnrollment.houseId));
    } else {
      conditions.push(eq(houseMaster.id, filters.house));
    }
  }
  if (filters.status !== "all") {
    if (filters.status === "completed") {
      conditions.push(inArray(studentEnrollment.status, ["completed", "graduated"]));
    } else {
      conditions.push(eq(studentEnrollment.status, filters.status));
    }
  }
  return and(...conditions)!;
}

function schoolStudentQuery(database: Database) {
  return database
    .select({
      personId: person.id,
      enrollmentId: studentEnrollment.id,
      displayName: person.displayName,
      primaryIdentifier: person.primaryIdentifier,
      status: person.status,
      gender: person.gender,
      dateOfBirth: person.dateOfBirth,
      currentPlacement: sql<string | null>`coalesce(
        (select coalesce(pp.home_name, pp.location_name)
          from person_placement pp
          where pp.person_id = ${person.id}
            and pp.organization_id = ${person.organizationId}
            and pp.is_current = 1
          order by date(pp.started_on) desc, pp.created_at desc
          limit 1),
        ${person.campusOrLocation}
      )`,
      schoolName: schoolMaster.name,
      className: academicClassMaster.name,
      classSection: academicClassMaster.section,
      classTitle: classDisplayName(),
      houseName: houseMaster.name,
      rollNumber: studentEnrollment.rollNumber,
      boardRegistrationNumber: studentEnrollment.boardRegistrationNumber,
      result: studentEnrollment.result,
      enrollmentStatus: studentEnrollment.status,
      statusSource: studentEnrollment.statusSource,
    })
    .from(studentEnrollment)
    .innerJoin(
      person,
      and(
        eq(person.id, studentEnrollment.personId),
        eq(person.organizationId, studentEnrollment.organizationId),
      ),
    )
    .innerJoin(
      academicClassMaster,
      and(
        eq(academicClassMaster.id, studentEnrollment.academicClassId),
        eq(academicClassMaster.organizationId, studentEnrollment.organizationId),
      ),
    )
    .leftJoin(
      schoolMaster,
      and(
        eq(schoolMaster.id, studentEnrollment.schoolId),
        eq(schoolMaster.organizationId, studentEnrollment.organizationId),
      ),
    )
    .leftJoin(
      houseMaster,
      and(
        eq(houseMaster.id, studentEnrollment.houseId),
        eq(houseMaster.organizationId, studentEnrollment.organizationId),
      ),
    )
    .$dynamic();
}

function schoolStudentCountQuery(database: Database) {
  return database
    .select({ total: count() })
    .from(studentEnrollment)
    .innerJoin(
      person,
      and(
        eq(person.id, studentEnrollment.personId),
        eq(person.organizationId, studentEnrollment.organizationId),
      ),
    )
    .innerJoin(
      academicClassMaster,
      and(
        eq(academicClassMaster.id, studentEnrollment.academicClassId),
        eq(academicClassMaster.organizationId, studentEnrollment.organizationId),
      ),
    )
    .leftJoin(
      schoolMaster,
      and(
        eq(schoolMaster.id, studentEnrollment.schoolId),
        eq(schoolMaster.organizationId, studentEnrollment.organizationId),
      ),
    )
    .leftJoin(
      houseMaster,
      and(
        eq(houseMaster.id, studentEnrollment.houseId),
        eq(houseMaster.organizationId, studentEnrollment.organizationId),
      ),
    )
    .$dynamic();
}

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
  const where = buildSchoolStudentFilters(scope, parsed.data);
  const runtime = getRuntimeEnv();
  const offset = (page - 1) * pageSize;
  const [countRows, students] = await Promise.all([
    schoolStudentCountQuery(runtime.ORM).where(where),
    schoolStudentQuery(runtime.ORM)
      .where(where)
      .orderBy(sql`${person.displayName} collate nocase`, person.primaryIdentifier)
      .limit(pageSize)
      .offset(offset),
  ]);
  const count = countRows[0];
  const total = Number(count?.total ?? 0);
  return Response.json({
    students: students.map((student) => ({
      ...student,
      canEdit:
        hasPermission(scope, "school.enrollment.manage") &&
        isOpenEnrollment(student.enrollmentStatus as StudentEnrollmentRecord["status"]),
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
  const where = buildSchoolStudentFilters(scope, parsed.data);
  const runtime = getRuntimeEnv();
  const [countRows, organizationRows] = await Promise.all([
    schoolStudentCountQuery(runtime.ORM).where(where),
    runtime.ORM.select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, scope.organizationId))
      .limit(1),
  ]);
  const count = countRows[0];
  const organizationRow = organizationRows[0];
  const total = Number(count?.total ?? 0);
  if (total > MAX_STUDENT_REPORT_ROWS) {
    return Response.json(
      {
        error: `This list has ${total.toLocaleString()} students. Narrow the filters to ${MAX_STUDENT_REPORT_ROWS.toLocaleString()} or fewer before printing or downloading.`,
      },
      { status: 422 },
    );
  }

  const students = await schoolStudentQuery(runtime.ORM)
    .where(where)
    .orderBy(
      sql`${schoolMaster.name} collate nocase`,
      sql`coalesce(${academicClassMaster.sortOrder}, 999)`,
      sql`${classDisplayName()} collate nocase`,
      sql`${person.displayName} collate nocase`,
      person.primaryIdentifier,
    )
    .limit(MAX_STUDENT_REPORT_ROWS);

  return Response.json({
    generatedAt: new Date().toISOString(),
    organizationName: organizationRow?.name ?? "School",
    session: scope.session,
    students,
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
  const enrollmentCounts = runtime.ORM.select({
    schoolId: studentEnrollment.schoolId,
    students: count(studentEnrollment.id).as("students"),
    currentActiveStudents:
      sql<number>`count(distinct case when ${person.status} = 'active' then ${studentEnrollment.personId} end)`.as(
        "current_active_students",
      ),
  })
    .from(studentEnrollment)
    .innerJoin(
      person,
      and(
        eq(person.id, studentEnrollment.personId),
        eq(person.organizationId, studentEnrollment.organizationId),
      ),
    )
    .where(
      and(
        eq(studentEnrollment.organizationId, scope.organizationId),
        eq(studentEnrollment.academicSessionId, scope.session.id),
      ),
    )
    .groupBy(studentEnrollment.schoolId)
    .as("enrollment_counts");
  const offeringCounts = runtime.ORM.select({
    schoolId: schoolClassOffering.schoolId,
    classes: sql<number>`count(distinct ${classDisplayName()})`.as("classes"),
  })
    .from(schoolClassOffering)
    .innerJoin(
      academicClassMaster,
      and(
        eq(academicClassMaster.id, schoolClassOffering.academicClassId),
        eq(academicClassMaster.organizationId, schoolClassOffering.organizationId),
      ),
    )
    .where(
      and(
        eq(schoolClassOffering.organizationId, scope.organizationId),
        eq(schoolClassOffering.academicSessionId, scope.session.id),
        eq(schoolClassOffering.isActive, 1),
      ),
    )
    .groupBy(schoolClassOffering.schoolId)
    .as("offering_counts");
  const houseCounts = runtime.ORM.select({
    schoolId: schoolHouseMaster.schoolId,
    houses: sql<number>`count(distinct ${schoolHouseMaster.houseId})`.as("houses"),
  })
    .from(schoolHouseMaster)
    .where(eq(schoolHouseMaster.organizationId, scope.organizationId))
    .groupBy(schoolHouseMaster.schoolId)
    .as("house_counts");
  const schools = await runtime.ORM.select({
    id: schoolMaster.id,
    name: schoolMaster.name,
    locationName: schoolMaster.locationName,
    affiliationNumber: schoolMaster.affiliationNumber,
    isActive: schoolMaster.isActive,
    students: sql<number>`coalesce(${enrollmentCounts.students}, 0)`,
    currentActiveStudents: sql<number>`coalesce(${enrollmentCounts.currentActiveStudents}, 0)`,
    classes: sql<number>`coalesce(${offeringCounts.classes}, 0)`,
    houses: sql<number>`coalesce(${houseCounts.houses}, 0)`,
  })
    .from(schoolMaster)
    .leftJoin(enrollmentCounts, eq(enrollmentCounts.schoolId, schoolMaster.id))
    .leftJoin(offeringCounts, eq(offeringCounts.schoolId, schoolMaster.id))
    .leftJoin(houseCounts, eq(houseCounts.schoolId, schoolMaster.id))
    .where(eq(schoolMaster.organizationId, scope.organizationId))
    .orderBy(desc(schoolMaster.isActive), sql`${schoolMaster.name} collate nocase`);

  return Response.json({
    session: scope.session,
    schools: schools.map((school) => ({ ...school, isActive: Boolean(school.isActive) })),
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
    readAcademicClassRows(runtime.ORM, scope.organizationId),
    runtime.ORM.select({
      id: houseMaster.id,
      name: houseMaster.name,
      isActive: houseMaster.isActive,
    })
      .from(houseMaster)
      .where(eq(houseMaster.organizationId, scope.organizationId))
      .orderBy(desc(houseMaster.isActive), asc(sql`lower(${houseMaster.name})`)),
  ]);

  return Response.json({
    canEdit: hasPermission(scope, "school.setup.manage"),
    session: scope.session,
    classes: groupAcademicClasses(classRows),
    houses: houses.map((house) => ({ ...house, isActive: Boolean(house.isActive) })),
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
  const rows = await readAcademicClassRows(runtime.ORM, context.organizationId);
  const displayName = academicClassName(parsed.data.name, parsed.data.section);
  if (
    rows.some(
      (row) => canonicalMasterName(academicClassRowName(row)) === canonicalMasterName(displayName),
    )
  ) {
    return Response.json({ error: "This class and section already exists." }, { status: 409 });
  }

  const id = crypto.randomUUID();
  await runtime.ORM.batch([
    runtime.ORM.insert(academicClassMaster).values({
      id,
      organizationId: context.organizationId,
      name: parsed.data.name,
      level: null,
      section: parsed.data.section,
      title: null,
      sortOrder: null,
      isActive: parsed.data.isActive ? 1 : 0,
      sourceSystem: "tsewa",
      sourceTable: "academic_class_master",
      sourceId: id,
    }),
    auditInsert(runtime.ORM, context, "class.created", "academic_class_master", id, {
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
  const rows = await readAcademicClassRows(runtime.ORM, context.organizationId);
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

  await runtime.ORM.batch([
    runtime.ORM.update(academicClassMaster)
      .set({
        name: parsed.data.name,
        title: null,
        section: parsed.data.section,
        level: null,
        sortOrder: null,
        isActive: parsed.data.isActive ? 1 : 0,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(academicClassMaster.organizationId, context.organizationId),
          inArray(
            academicClassMaster.id,
            group.map((row) => row.id),
          ),
        ),
      ),
    auditInsert(runtime.ORM, context, "class.updated", "academic_class_master", selected.id, {
      previousName: academicClassRowName(selected),
      name: newName,
      matchingRecords: String(group.length),
      active: String(parsed.data.isActive),
    }),
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
  const duplicate = await runtime.ORM.select({ id: houseMaster.id })
    .from(houseMaster)
    .where(
      and(
        eq(houseMaster.organizationId, context.organizationId),
        eq(sql`lower(trim(${houseMaster.name}))`, parsed.data.name.trim().toLowerCase()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (duplicate)
    return Response.json({ error: "A house with this name already exists." }, { status: 409 });
  const id = crypto.randomUUID();
  await runtime.ORM.batch([
    runtime.ORM.insert(houseMaster).values({
      id,
      organizationId: context.organizationId,
      name: parsed.data.name,
      isActive: parsed.data.isActive ? 1 : 0,
      sourceSystem: "tsewa",
      sourceTable: "house_master",
      sourceId: id,
    }),
    auditInsert(runtime.ORM, context, "house.created", "house_master", id, {
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
    runtime.ORM.select({ id: houseMaster.id, name: houseMaster.name })
      .from(houseMaster)
      .where(
        and(
          eq(houseMaster.id, parsedId.data),
          eq(houseMaster.organizationId, context.organizationId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    runtime.ORM.select({ id: houseMaster.id })
      .from(houseMaster)
      .where(
        and(
          eq(houseMaster.organizationId, context.organizationId),
          eq(sql`lower(trim(${houseMaster.name}))`, parsed.data.name.trim().toLowerCase()),
          ne(houseMaster.id, parsedId.data),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);
  if (!house) return Response.json({ error: "House not found" }, { status: 404 });
  if (duplicate)
    return Response.json({ error: "A house with this name already exists." }, { status: 409 });
  await runtime.ORM.batch([
    runtime.ORM.update(houseMaster)
      .set({
        name: parsed.data.name,
        isActive: parsed.data.isActive ? 1 : 0,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(houseMaster.id, parsedId.data),
          eq(houseMaster.organizationId, context.organizationId),
        ),
      ),
    auditInsert(runtime.ORM, context, "house.updated", "house_master", parsedId.data, {
      previousName: house.name,
      name: parsed.data.name,
      active: String(parsed.data.isActive),
    }),
  ]);
  return Response.json({ ok: true, id: parsedId.data });
}

async function readAcademicClassRows(database: Database, organizationId: string) {
  return database
    .select({
      id: academicClassMaster.id,
      name: academicClassMaster.name,
      title: academicClassMaster.title,
      section: academicClassMaster.section,
      level: academicClassMaster.level,
      sortOrder: academicClassMaster.sortOrder,
      isActive: academicClassMaster.isActive,
    })
    .from(academicClassMaster)
    .where(eq(academicClassMaster.organizationId, organizationId))
    .orderBy(
      asc(sql`coalesce(${academicClassMaster.sortOrder}, 999)`),
      asc(sql`coalesce(${academicClassMaster.level}, 999)`),
      asc(sql`lower(${academicClassMaster.name})`),
    );
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
  const duplicate = await runtime.ORM.select({ id: schoolMaster.id })
    .from(schoolMaster)
    .where(
      and(
        eq(schoolMaster.organizationId, context.organizationId),
        eq(sql`lower(trim(${schoolMaster.name}))`, parsed.data.name.trim().toLowerCase()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (duplicate) {
    return Response.json({ error: "A school with this name already exists." }, { status: 409 });
  }

  const id = crypto.randomUUID();
  await runtime.ORM.batch([
    runtime.ORM.insert(schoolMaster).values({
      id,
      organizationId: context.organizationId,
      name: parsed.data.name,
      locationName: parsed.data.locationName,
      affiliationNumber: parsed.data.affiliationNumber,
      isActive: parsed.data.isActive ? 1 : 0,
      sourceSystem: "tsewa",
      sourceTable: "school_master",
      sourceId: id,
    }),
    auditInsert(runtime.ORM, context, "school.created", "school_master", id, {
      name: parsed.data.name,
    }),
  ]);

  return Response.json({ id, name: parsed.data.name }, { status: 201 });
}

async function updateSchoolMaster(request: Request, schoolId: string): Promise<Response> {
  if (request.method !== "PATCH" && request.method !== "DELETE") {
    return methodNotAllowed("PATCH, DELETE");
  }
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "school.setup.manage")) return forbidden();

  const parsedId = z.uuid().safeParse(schoolId);
  if (!parsedId.success) return Response.json({ error: "Invalid school." }, { status: 400 });
  const runtime = getRuntimeEnv();
  if (request.method === "DELETE") {
    const [school, enrollmentRows] = await Promise.all([
      runtime.ORM.select({ id: schoolMaster.id, name: schoolMaster.name })
        .from(schoolMaster)
        .where(
          and(
            eq(schoolMaster.id, parsedId.data),
            eq(schoolMaster.organizationId, context.organizationId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      runtime.ORM.select({ total: count() })
        .from(studentEnrollment)
        .where(
          and(
            eq(studentEnrollment.schoolId, parsedId.data),
            eq(studentEnrollment.organizationId, context.organizationId),
          ),
        ),
    ]);
    if (!school) return Response.json({ error: "School not found" }, { status: 404 });
    const enrollments = Number(enrollmentRows[0]?.total ?? 0);
    if (enrollments > 0) {
      return Response.json(
        {
          error: `This school has ${enrollments.toLocaleString()} student records. Mark it inactive to preserve their history.`,
        },
        { status: 409 },
      );
    }
    await runtime.ORM.batch([
      runtime.ORM.delete(schoolClassOffering).where(
        and(
          eq(schoolClassOffering.schoolId, parsedId.data),
          eq(schoolClassOffering.organizationId, context.organizationId),
        ),
      ),
      runtime.ORM.delete(schoolHouseMaster).where(
        and(
          eq(schoolHouseMaster.schoolId, parsedId.data),
          eq(schoolHouseMaster.organizationId, context.organizationId),
        ),
      ),
      runtime.ORM.delete(schoolMaster).where(
        and(
          eq(schoolMaster.id, parsedId.data),
          eq(schoolMaster.organizationId, context.organizationId),
        ),
      ),
      auditInsert(runtime.ORM, context, "school.deleted", "school_master", parsedId.data, {
        name: school.name,
      }),
    ]);
    return Response.json({ ok: true, deleted: true });
  }
  const parsed = schoolMasterSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success) {
    return Response.json({ error: "Check the school details." }, { status: 400 });
  }

  const [school, duplicate] = await Promise.all([
    runtime.ORM.select({ id: schoolMaster.id, name: schoolMaster.name })
      .from(schoolMaster)
      .where(
        and(
          eq(schoolMaster.id, parsedId.data),
          eq(schoolMaster.organizationId, context.organizationId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    runtime.ORM.select({ id: schoolMaster.id })
      .from(schoolMaster)
      .where(
        and(
          eq(schoolMaster.organizationId, context.organizationId),
          eq(sql`lower(trim(${schoolMaster.name}))`, parsed.data.name.trim().toLowerCase()),
          ne(schoolMaster.id, parsedId.data),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);
  if (!school) return Response.json({ error: "School not found" }, { status: 404 });
  if (duplicate) {
    return Response.json({ error: "A school with this name already exists." }, { status: 409 });
  }

  await runtime.ORM.batch([
    runtime.ORM.update(schoolMaster)
      .set({
        name: parsed.data.name,
        locationName: parsed.data.locationName,
        affiliationNumber: parsed.data.affiliationNumber,
        isActive: parsed.data.isActive ? 1 : 0,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(schoolMaster.id, parsedId.data),
          eq(schoolMaster.organizationId, context.organizationId),
        ),
      ),
    auditInsert(runtime.ORM, context, "school.updated", "school_master", parsedId.data, {
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
  const school = await runtime.ORM.select({ id: schoolMaster.id, name: schoolMaster.name })
    .from(schoolMaster)
    .where(
      and(eq(schoolMaster.id, schoolId), eq(schoolMaster.organizationId, scope.organizationId)),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!school) return Response.json({ error: "School not found." }, { status: 404 });

  const [classRows, offerings, enrollmentClasses, houses, schoolHouses, enrollmentHouses] =
    await Promise.all([
      readAcademicClassRows(runtime.ORM, scope.organizationId),
      runtime.ORM.select({
        id: schoolClassOffering.id,
        academicClassId: schoolClassOffering.academicClassId,
        isActive: schoolClassOffering.isActive,
      })
        .from(schoolClassOffering)
        .where(
          and(
            eq(schoolClassOffering.organizationId, scope.organizationId),
            eq(schoolClassOffering.academicSessionId, scope.session.id),
            eq(schoolClassOffering.schoolId, schoolId),
          ),
        ),
      runtime.ORM.select({
        academicClassId: studentEnrollment.academicClassId,
        students: count(),
      })
        .from(studentEnrollment)
        .where(
          and(
            eq(studentEnrollment.organizationId, scope.organizationId),
            eq(studentEnrollment.academicSessionId, scope.session.id),
            eq(studentEnrollment.schoolId, schoolId),
          ),
        )
        .groupBy(studentEnrollment.academicClassId),
      runtime.ORM.select({
        id: houseMaster.id,
        name: houseMaster.name,
        isActive: houseMaster.isActive,
      })
        .from(houseMaster)
        .where(eq(houseMaster.organizationId, scope.organizationId))
        .orderBy(desc(houseMaster.isActive), asc(sql`lower(${houseMaster.name})`)),
      runtime.ORM.select({ houseId: schoolHouseMaster.houseId })
        .from(schoolHouseMaster)
        .where(
          and(
            eq(schoolHouseMaster.organizationId, scope.organizationId),
            eq(schoolHouseMaster.schoolId, schoolId),
          ),
        ),
      runtime.ORM.select({ houseId: studentEnrollment.houseId, students: count() })
        .from(studentEnrollment)
        .where(
          and(
            eq(studentEnrollment.organizationId, scope.organizationId),
            eq(studentEnrollment.academicSessionId, scope.session.id),
            eq(studentEnrollment.schoolId, schoolId),
            sql`${studentEnrollment.houseId} IS NOT NULL`,
          ),
        )
        .groupBy(studentEnrollment.houseId),
    ]);

  const activeOfferingIds = new Set(
    offerings.filter((item) => Boolean(item.isActive)).map((item) => item.academicClassId),
  );
  const classStudentCounts = new Map(
    enrollmentClasses.map((item) => [item.academicClassId, Number(item.students)]),
  );
  const assignedHouseIds = new Set(schoolHouses.map((item) => item.houseId));
  const houseStudentCounts = new Map(
    enrollmentHouses.map((item) => [item.houseId, Number(item.students)]),
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
    houses: houses
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
  const school = await runtime.ORM.select({ id: schoolMaster.id, name: schoolMaster.name })
    .from(schoolMaster)
    .where(
      and(eq(schoolMaster.id, schoolId), eq(schoolMaster.organizationId, scope.organizationId)),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!school) return Response.json({ error: "School not found." }, { status: 404 });

  const [classRows, offerings, enrollmentClasses, houses, schoolHouses, enrollmentHouses] =
    await Promise.all([
      readAcademicClassRows(runtime.ORM, scope.organizationId),
      runtime.ORM.select({
        id: schoolClassOffering.id,
        academicClassId: schoolClassOffering.academicClassId,
        isActive: schoolClassOffering.isActive,
      })
        .from(schoolClassOffering)
        .where(
          and(
            eq(schoolClassOffering.organizationId, scope.organizationId),
            eq(schoolClassOffering.academicSessionId, scope.session.id),
            eq(schoolClassOffering.schoolId, schoolId),
          ),
        ),
      runtime.ORM.select({
        academicClassId: studentEnrollment.academicClassId,
        students: count(),
      })
        .from(studentEnrollment)
        .where(
          and(
            eq(studentEnrollment.organizationId, scope.organizationId),
            eq(studentEnrollment.academicSessionId, scope.session.id),
            eq(studentEnrollment.schoolId, schoolId),
          ),
        )
        .groupBy(studentEnrollment.academicClassId),
      runtime.ORM.select({
        id: houseMaster.id,
        name: houseMaster.name,
        isActive: houseMaster.isActive,
      })
        .from(houseMaster)
        .where(eq(houseMaster.organizationId, scope.organizationId)),
      runtime.ORM.select({ id: schoolHouseMaster.id, houseId: schoolHouseMaster.houseId })
        .from(schoolHouseMaster)
        .where(
          and(
            eq(schoolHouseMaster.organizationId, scope.organizationId),
            eq(schoolHouseMaster.schoolId, schoolId),
          ),
        ),
      runtime.ORM.select({ houseId: studentEnrollment.houseId, students: count() })
        .from(studentEnrollment)
        .where(
          and(
            eq(studentEnrollment.organizationId, scope.organizationId),
            eq(studentEnrollment.academicSessionId, scope.session.id),
            eq(studentEnrollment.schoolId, schoolId),
            sql`${studentEnrollment.houseId} IS NOT NULL`,
          ),
        )
        .groupBy(studentEnrollment.houseId),
    ]);

  const classGroups = groupAcademicClassRows(classRows);
  const displayedClasses = classGroups.map((group) => ({
    group,
    display: groupAcademicClasses(group)[0],
  }));
  const classesById = new Map(displayedClasses.map((item) => [item.display.id, item]));
  const housesById = new Map(houses.map((house) => [house.id, house]));
  const selectedClassIds = new Set(parsed.data.classIds);
  const selectedHouseIds = new Set(parsed.data.houseIds);
  if (
    [...selectedClassIds].some((id) => !classesById.get(id)?.display.isActive) ||
    [...selectedHouseIds].some((id) => !housesById.get(id)?.isActive)
  ) {
    return Response.json({ error: "Choose only active classes and houses." }, { status: 400 });
  }

  const offeringByClassId = new Map<string, (typeof offerings)[number]>();
  for (const offering of offerings) offeringByClassId.set(offering.academicClassId, offering);
  const classStudentCounts = new Map(
    enrollmentClasses.map((item) => [item.academicClassId, Number(item.students)]),
  );
  const schoolHouseByHouseId = new Map(schoolHouses.map((item) => [item.houseId, item]));
  const houseStudentCounts = new Map(
    enrollmentHouses.map((item) => [item.houseId, Number(item.students)]),
  );

  const blockedClasses = displayedClasses
    .filter(
      ({ display, group }) =>
        !selectedClassIds.has(display.id) &&
        group.some((row) => Boolean(offeringByClassId.get(row.id)?.isActive)) &&
        group.some((row) => (classStudentCounts.get(row.id) ?? 0) > 0),
    )
    .map(({ display }) => display.name);
  const blockedHouses = houses
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

  const offeringIdsToActivate: string[] = [];
  const offeringIdsToDeactivate: string[] = [];
  const offeringsToInsert: Array<typeof schoolClassOffering.$inferInsert> = [];
  for (const { display, group } of displayedClasses) {
    const shouldAssign = selectedClassIds.has(display.id);
    const current = group.map((row) => offeringByClassId.get(row.id)).filter(Boolean);
    if (shouldAssign) {
      const representative = offeringByClassId.get(display.id);
      if (representative) {
        if (!representative.isActive) {
          offeringIdsToActivate.push(representative.id);
        }
      } else {
        const id = crypto.randomUUID();
        offeringsToInsert.push({
          id,
          organizationId: scope.organizationId,
          academicSessionId: scope.session.id,
          schoolId,
          academicClassId: display.id,
          origin: "manual",
          sourceSystem: "tsewa",
          sourceTable: "school_class_offering",
          sourceId: id,
        });
      }
    } else {
      for (const offering of current) {
        if (offering?.isActive) {
          offeringIdsToDeactivate.push(offering.id);
        }
      }
    }
  }
  const schoolHousesToInsert: Array<typeof schoolHouseMaster.$inferInsert> = [];
  const schoolHouseIdsToDelete: string[] = [];
  for (const house of houses) {
    const current = schoolHouseByHouseId.get(house.id);
    if (selectedHouseIds.has(house.id) && !current) {
      const id = crypto.randomUUID();
      schoolHousesToInsert.push({
        id,
        organizationId: scope.organizationId,
        schoolId,
        houseId: house.id,
        sourceSystem: "tsewa",
        sourceTable: "school_house_master",
        sourceId: id,
      });
    } else if (!selectedHouseIds.has(house.id) && current) {
      schoolHouseIdsToDelete.push(current.id);
    }
  }
  const writes: BatchItem<"sqlite">[] = [];
  if (offeringIdsToActivate.length) {
    writes.push(
      runtime.ORM.update(schoolClassOffering)
        .set({ isActive: 1, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(
            eq(schoolClassOffering.organizationId, scope.organizationId),
            inArray(schoolClassOffering.id, offeringIdsToActivate),
          ),
        ),
    );
  }
  if (offeringIdsToDeactivate.length) {
    writes.push(
      runtime.ORM.update(schoolClassOffering)
        .set({ isActive: 0, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(
            eq(schoolClassOffering.organizationId, scope.organizationId),
            inArray(schoolClassOffering.id, offeringIdsToDeactivate),
          ),
        ),
    );
  }
  if (offeringsToInsert.length) {
    writes.push(runtime.ORM.insert(schoolClassOffering).values(offeringsToInsert));
  }
  if (schoolHousesToInsert.length) {
    writes.push(runtime.ORM.insert(schoolHouseMaster).values(schoolHousesToInsert));
  }
  if (schoolHouseIdsToDelete.length) {
    writes.push(
      runtime.ORM.delete(schoolHouseMaster).where(
        and(
          eq(schoolHouseMaster.organizationId, scope.organizationId),
          inArray(schoolHouseMaster.id, schoolHouseIdsToDelete),
        ),
      ),
    );
  }
  writes.push(
    auditInsert(runtime.ORM, scope, "school.assignments_updated", "school_master", schoolId, {
      academicSessionId: scope.session.id,
      classes: String(selectedClassIds.size),
      houses: String(selectedHouseIds.size),
    }),
  );
  await runtime.ORM.batch(writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
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
    eq(schoolClassOffering.organizationId, scope.organizationId),
    eq(schoolClassOffering.academicSessionId, scope.session.id),
    eq(schoolClassOffering.isActive, 1),
  ];
  if (parsed.data.school !== "all") conditions.push(eq(schoolMaster.id, parsed.data.school));
  if (parsed.data.q) {
    const search = `%${escapeLikePattern(parsed.data.q.toLowerCase())}%`;
    conditions.push(
      or(
        sql`lower(${schoolMaster.name}) LIKE ${search} ESCAPE '\\'`,
        sql`lower(case when ${academicClassMaster.section} is null or trim(${academicClassMaster.section}) = '' then ${academicClassMaster.name} else ${academicClassMaster.name} || ' · ' || ${academicClassMaster.section} end) LIKE ${search} ESCAPE '\\'`,
      )!,
    );
  }

  const runtime = getRuntimeEnv();
  const classNameExpression = sql<string>`case when ${academicClassMaster.section} is null or trim(${academicClassMaster.section}) = '' then ${academicClassMaster.name} else ${academicClassMaster.name} || ' · ' || ${academicClassMaster.section} end`;
  const rosters = await runtime.ORM.select({
    id: sql<string>`min(${schoolClassOffering.id})`,
    schoolId: schoolMaster.id,
    schoolName: schoolMaster.name,
    classId: classNameExpression,
    className: classNameExpression,
    classLevel: sql<number | null>`max(${academicClassMaster.level})`,
    classSection: sql<string | null>`max(${academicClassMaster.section})`,
    students: sql<number>`count(distinct ${studentEnrollment.id})`,
    currentActiveStudents: sql<number>`count(distinct case when ${person.status} = 'active' then ${studentEnrollment.personId} end)`,
    femaleStudents: sql<number>`count(distinct case when ${person.gender} = 'female' then ${studentEnrollment.personId} end)`,
    maleStudents: sql<number>`count(distinct case when ${person.gender} = 'male' then ${studentEnrollment.personId} end)`,
    houses: sql<number>`count(distinct ${studentEnrollment.houseId})`,
  })
    .from(schoolClassOffering)
    .innerJoin(
      schoolMaster,
      and(
        eq(schoolMaster.id, schoolClassOffering.schoolId),
        eq(schoolMaster.organizationId, schoolClassOffering.organizationId),
      ),
    )
    .innerJoin(
      academicClassMaster,
      and(
        eq(academicClassMaster.id, schoolClassOffering.academicClassId),
        eq(academicClassMaster.organizationId, schoolClassOffering.organizationId),
      ),
    )
    .leftJoin(
      studentEnrollment,
      and(
        eq(studentEnrollment.schoolClassOfferingId, schoolClassOffering.id),
        eq(studentEnrollment.organizationId, schoolClassOffering.organizationId),
      ),
    )
    .leftJoin(
      person,
      and(
        eq(person.id, studentEnrollment.personId),
        eq(person.organizationId, studentEnrollment.organizationId),
      ),
    )
    .where(and(...conditions))
    .groupBy(schoolMaster.id, schoolMaster.name, classNameExpression)
    .orderBy(
      asc(sql`lower(${schoolMaster.name})`),
      asc(sql`coalesce(min(${academicClassMaster.sortOrder}), 999)`),
      asc(sql`coalesce(max(${academicClassMaster.level}), 999)`),
      asc(sql`lower(${classNameExpression})`),
    );

  return Response.json({ session: scope.session, rosters });
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
  const sessions = await runtime.ORM.select({
    id: academicSession.id,
    name: academicSession.name,
    markSheets: sql<number>`count(distinct ${markSheet.id})`,
    results: count(studentMark.id),
  })
    .from(academicSession)
    .innerJoin(
      markSheet,
      and(
        eq(markSheet.academicSessionId, academicSession.id),
        eq(markSheet.organizationId, academicSession.organizationId),
      ),
    )
    .leftJoin(
      studentMark,
      and(
        eq(studentMark.markSheetId, markSheet.id),
        eq(studentMark.organizationId, markSheet.organizationId),
      ),
    )
    .where(eq(academicSession.organizationId, context.organizationId))
    .groupBy(academicSession.id, academicSession.name, academicSession.startsOn)
    .orderBy(desc(academicSession.startsOn));
  const selectedId = parsed.data.sessionId ?? sessions[0]?.id;
  if (!selectedId)
    return Response.json({
      sessions: [],
      selectedSessionId: null,
      summary: { markSheets: 0, results: 0, students: 0 },
      filters: { schools: [], classes: [], subjects: [], terms: [] },
    });
  if (!sessions.some((session) => session.id === selectedId)) return forbidden();

  const [summaryRows, schools, classes, subjects, terms] = await runtime.ORM.batch([
    runtime.ORM.select({
      markSheets: sql<number>`count(distinct ${markSheet.id})`,
      results: count(studentMark.id),
      students: sql<number>`count(distinct ${studentMark.personId})`,
    })
      .from(markSheet)
      .leftJoin(
        studentMark,
        and(
          eq(studentMark.markSheetId, markSheet.id),
          eq(studentMark.organizationId, markSheet.organizationId),
        ),
      )
      .where(
        and(
          eq(markSheet.organizationId, context.organizationId),
          eq(markSheet.academicSessionId, selectedId),
        ),
      ),
    runtime.ORM.select({
      id: schoolMaster.id,
      name: schoolMaster.name,
      count: count(studentMark.id),
    })
      .from(markSheet)
      .innerJoin(schoolMaster, eq(schoolMaster.id, markSheet.schoolId))
      .leftJoin(
        studentMark,
        and(
          eq(studentMark.markSheetId, markSheet.id),
          eq(studentMark.organizationId, markSheet.organizationId),
          eq(studentMark.isActive, 1),
        ),
      )
      .where(
        and(
          eq(markSheet.organizationId, context.organizationId),
          eq(markSheet.academicSessionId, selectedId),
        ),
      )
      .groupBy(schoolMaster.id, schoolMaster.name)
      .orderBy(asc(sql`lower(${schoolMaster.name})`)),
    runtime.ORM.select({
      id: academicClassMaster.id,
      name: sql<string>`case when ${academicClassMaster.section} is null or trim(${academicClassMaster.section}) = '' then ${academicClassMaster.name} else ${academicClassMaster.name} || ' · ' || ${academicClassMaster.section} end`,
      count: count(studentMark.id),
    })
      .from(markSheet)
      .innerJoin(academicClassMaster, eq(academicClassMaster.id, markSheet.academicClassId))
      .leftJoin(
        studentMark,
        and(
          eq(studentMark.markSheetId, markSheet.id),
          eq(studentMark.organizationId, markSheet.organizationId),
          eq(studentMark.isActive, 1),
        ),
      )
      .where(
        and(
          eq(markSheet.organizationId, context.organizationId),
          eq(markSheet.academicSessionId, selectedId),
        ),
      )
      .groupBy(academicClassMaster.id, academicClassMaster.name, academicClassMaster.section)
      .orderBy(asc(sql`lower(${academicClassMaster.name})`)),
    runtime.ORM.select({
      id: academicSubject.id,
      name: academicSubject.name,
      count: count(studentMark.id),
    })
      .from(markSheet)
      .innerJoin(academicSubject, eq(academicSubject.id, markSheet.subjectId))
      .leftJoin(
        studentMark,
        and(
          eq(studentMark.markSheetId, markSheet.id),
          eq(studentMark.organizationId, markSheet.organizationId),
          eq(studentMark.isActive, 1),
        ),
      )
      .where(
        and(
          eq(markSheet.organizationId, context.organizationId),
          eq(markSheet.academicSessionId, selectedId),
        ),
      )
      .groupBy(academicSubject.id, academicSubject.name)
      .orderBy(asc(sql`lower(${academicSubject.name})`)),
    runtime.ORM.select({
      id: academicTerm.id,
      name: academicTerm.name,
      count: count(studentMark.id),
    })
      .from(markSheet)
      .innerJoin(academicTerm, eq(academicTerm.id, markSheet.termId))
      .leftJoin(
        studentMark,
        and(
          eq(studentMark.markSheetId, markSheet.id),
          eq(studentMark.organizationId, markSheet.organizationId),
          eq(studentMark.isActive, 1),
        ),
      )
      .where(
        and(
          eq(markSheet.organizationId, context.organizationId),
          eq(markSheet.academicSessionId, selectedId),
        ),
      )
      .groupBy(academicTerm.id, academicTerm.name)
      .orderBy(asc(sql`lower(${academicTerm.name})`)),
  ]);
  const summary = summaryRows[0] ?? null;
  return Response.json({
    sessions,
    selectedSessionId: selectedId,
    summary: {
      markSheets: Number(summary?.markSheets ?? 0),
      results: Number(summary?.results ?? 0),
      students: Number(summary?.students ?? 0),
    },
    filters: {
      schools,
      classes,
      subjects,
      terms,
    },
  });
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
  const conditions = [
    eq(markSheet.organizationId, context.organizationId),
    eq(markSheet.academicSessionId, sessionId),
    eq(studentMark.isActive, 1),
  ];
  if (school !== "all") conditions.push(eq(markSheet.schoolId, school));
  if (className !== "all") conditions.push(eq(markSheet.academicClassId, className));
  if (subject !== "all") conditions.push(eq(markSheet.subjectId, subject));
  if (term !== "all") conditions.push(eq(markSheet.termId, term));
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      or(
        sql`lower(${person.displayName}) LIKE ${search} ESCAPE '\\'`,
        sql`lower(${person.primaryIdentifier}) LIKE ${search} ESCAPE '\\'`,
      )!,
    );
  }
  const where = and(...conditions);
  const runtime = getRuntimeEnv();
  const [countRows, rows] = await runtime.ORM.batch([
    runtime.ORM.select({ total: count() })
      .from(studentMark)
      .innerJoin(markSheet, eq(markSheet.id, studentMark.markSheetId))
      .innerJoin(
        person,
        and(
          eq(person.id, studentMark.personId),
          eq(person.organizationId, studentMark.organizationId),
        ),
      )
      .where(where),
    runtime.ORM.select({
      id: studentMark.id,
      personId: person.id,
      studentName: person.displayName,
      admissionNumber: person.primaryIdentifier,
      schoolName: schoolMaster.name,
      className: sql<string>`case when ${academicClassMaster.section} is null or trim(${academicClassMaster.section}) = '' then ${academicClassMaster.name} else ${academicClassMaster.name} || ' · ' || ${academicClassMaster.section} end`,
      subjectName: academicSubject.name,
      termName: academicTerm.name,
      assessmentName: academicAssessment.name,
      marks: studentMark.marks,
      maximumMarks: studentMark.maximumMarks,
      note: studentMark.note,
      recordedOn: markSheet.recordedOn,
      isVerified: markSheet.isVerified,
      sheetStatus: markSheet.status,
      markSheetId: markSheet.id,
      sourceSystem: markSheet.sourceSystem,
    })
      .from(studentMark)
      .innerJoin(markSheet, eq(markSheet.id, studentMark.markSheetId))
      .innerJoin(
        person,
        and(
          eq(person.id, studentMark.personId),
          eq(person.organizationId, studentMark.organizationId),
        ),
      )
      .innerJoin(schoolMaster, eq(schoolMaster.id, markSheet.schoolId))
      .innerJoin(academicClassMaster, eq(academicClassMaster.id, markSheet.academicClassId))
      .innerJoin(academicSubject, eq(academicSubject.id, markSheet.subjectId))
      .innerJoin(academicTerm, eq(academicTerm.id, markSheet.termId))
      .innerJoin(academicAssessment, eq(academicAssessment.id, studentMark.assessmentId))
      .where(where)
      .orderBy(
        asc(sql`lower(${person.displayName})`),
        asc(sql`lower(${academicSubject.name})`),
        asc(sql`lower(${academicAssessment.name})`),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  return Response.json({
    results: rows.map((row) => ({ ...row, isVerified: Boolean(row.isVerified) })),
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
  ] = await db.batch([
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
  ] = await runtime.ORM.batch([
    runtime.ORM.selectDistinct({ id: schoolMaster.id, name: schoolMaster.name })
      .from(schoolClassOffering)
      .innerJoin(schoolMaster, eq(schoolMaster.id, schoolClassOffering.schoolId))
      .where(
        and(
          eq(schoolClassOffering.organizationId, scope.organizationId),
          eq(schoolClassOffering.academicSessionId, scope.session.id),
          eq(schoolClassOffering.isActive, 1),
        ),
      )
      .orderBy(asc(sql`lower(${schoolMaster.name})`)),
    runtime.ORM.select({
      schoolId: schoolClassOffering.schoolId,
      id: academicClassMaster.id,
      name: sql<string>`case when ${academicClassMaster.section} is null or trim(${academicClassMaster.section}) = '' then ${academicClassMaster.name} else ${academicClassMaster.name} || ' · ' || ${academicClassMaster.section} end`,
    })
      .from(schoolClassOffering)
      .innerJoin(
        academicClassMaster,
        eq(academicClassMaster.id, schoolClassOffering.academicClassId),
      )
      .where(
        and(
          eq(schoolClassOffering.organizationId, scope.organizationId),
          eq(schoolClassOffering.academicSessionId, scope.session.id),
          eq(schoolClassOffering.isActive, 1),
        ),
      )
      .orderBy(
        asc(sql`coalesce(${academicClassMaster.level}, 999)`),
        asc(sql`lower(${academicClassMaster.name})`),
      ),
    runtime.ORM.select({
      id: academicSubject.id,
      name: academicSubject.name,
      shortName: academicSubject.shortName,
      isOptional: academicSubject.isOptional,
      passingPercentage: academicSubject.passingPercentage,
    })
      .from(academicSubject)
      .where(
        and(
          eq(academicSubject.organizationId, scope.organizationId),
          eq(academicSubject.academicSessionId, scope.session.id),
          eq(academicSubject.isActive, 1),
        ),
      )
      .orderBy(asc(sql`lower(${academicSubject.name})`)),
    runtime.ORM.select({ id: academicTerm.id, name: academicTerm.name })
      .from(academicTerm)
      .where(
        and(eq(academicTerm.organizationId, scope.organizationId), eq(academicTerm.isActive, 1)),
      )
      .orderBy(asc(sql`lower(${academicTerm.name})`)),
    runtime.ORM.select({
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
    runtime.ORM.select({
      schoolId: studentEnrollment.schoolId,
      academicClassId: studentEnrollment.academicClassId,
      id: person.id,
      name: person.displayName,
      admissionNumber: person.primaryIdentifier,
    })
      .from(studentEnrollment)
      .innerJoin(person, eq(person.id, studentEnrollment.personId))
      .where(
        and(
          eq(studentEnrollment.organizationId, scope.organizationId),
          eq(studentEnrollment.academicSessionId, scope.session.id),
          inArray(studentEnrollment.status, ["recorded", "enrolled"]),
          eq(person.status, "active"),
        ),
      )
      .orderBy(asc(sql`lower(${person.displayName})`)),
    runtime.ORM.select({
      academicClassId: academicClassSubject.academicClassId,
      subjectId: academicClassSubject.subjectId,
      maximumMarks: academicClassSubject.maximumMarks,
      displayOrder: academicClassSubject.displayOrder,
    })
      .from(academicClassSubject)
      .where(
        and(
          eq(academicClassSubject.organizationId, scope.organizationId),
          eq(academicClassSubject.academicSessionId, scope.session.id),
        ),
      )
      .orderBy(asc(academicClassSubject.academicClassId), asc(academicClassSubject.displayOrder)),
    runtime.ORM.select({
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
    schools,
    classes,
    subjects: subjects.map((subject) => ({
      ...subject,
      isOptional: Boolean(subject.isOptional),
    })),
    terms,
    assessments,
    students,
    classSubjects,
    assessmentLimits,
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
  const duplicateSubject = await runtime.ORM.select({ id: academicSubject.id })
    .from(academicSubject)
    .where(
      and(
        eq(academicSubject.organizationId, scope.organizationId),
        eq(academicSubject.academicSessionId, scope.session.id),
        eq(sql`lower(${academicSubject.name})`, parsed.data.subject.name.toLowerCase()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
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
  const existingTerm = await runtime.ORM.select({ id: academicTerm.id })
    .from(academicTerm)
    .where(
      and(
        eq(academicTerm.organizationId, scope.organizationId),
        eq(sql`lower(${academicTerm.name})`, parsed.data.term.name.toLowerCase()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  const termId = existingTerm?.id ?? crypto.randomUUID();
  const subjectId = crypto.randomUUID();
  if (!existingTerm) {
    await runtime.ORM.insert(academicTerm).values({
      id: termId,
      organizationId: scope.organizationId,
      name: parsed.data.term.name,
      isActive: 1,
      sourceSystem: "tsewa",
      sourceTable: "academic_term",
      sourceId: termId,
    });
  }
  await runtime.ORM.insert(academicSubject).values({
    id: subjectId,
    organizationId: scope.organizationId,
    academicSessionId: scope.session.id,
    name: parsed.data.subject.name,
    shortName: parsed.data.subject.shortName ?? null,
    isOptional: parsed.data.subject.isOptional ? 1 : 0,
    passingPercentage: parsed.data.subject.passingPercentage ?? null,
    isActive: 1,
    sourceSystem: "tsewa",
    sourceTable: "academic_subject",
    sourceId: subjectId,
  });
  const assessments = parsed.data.assessments.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
  }));
  await runtime.ORM.insert(academicAssessment).values(
    assessments.map((assessment) => ({
      id: assessment.id,
      organizationId: scope.organizationId,
      academicSessionId: scope.session.id,
      termId,
      name: assessment.name,
      isActive: 1,
      sourceSystem: "tsewa",
      sourceTable: "academic_assessment",
      sourceId: assessment.id,
    })),
  );
  await auditInsert(
    runtime.ORM,
    scope,
    "academic.result_catalog_created",
    "academic_subject",
    subjectId,
    {
      sessionId: scope.session.id,
      termId,
      assessmentCount: String(assessments.length),
    },
  );
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
    offeringRows,
    subjectRows,
    termRows,
    assessments,
    roster,
    existingRows,
    configuredSubjects,
    configuredLimits,
  ] = await runtime.ORM.batch([
    runtime.ORM.select({ id: schoolClassOffering.id })
      .from(schoolClassOffering)
      .where(
        and(
          eq(schoolClassOffering.organizationId, scope.organizationId),
          eq(schoolClassOffering.academicSessionId, scope.session.id),
          eq(schoolClassOffering.schoolId, data.schoolId),
          eq(schoolClassOffering.academicClassId, data.academicClassId),
          eq(schoolClassOffering.isActive, 1),
        ),
      )
      .limit(1),
    runtime.ORM.select({ id: academicSubject.id })
      .from(academicSubject)
      .where(
        and(
          eq(academicSubject.id, data.subjectId),
          eq(academicSubject.organizationId, scope.organizationId),
          eq(academicSubject.academicSessionId, scope.session.id),
          eq(academicSubject.isActive, 1),
        ),
      )
      .limit(1),
    runtime.ORM.select({ id: academicTerm.id })
      .from(academicTerm)
      .where(
        and(
          eq(academicTerm.id, data.termId),
          eq(academicTerm.organizationId, scope.organizationId),
          eq(academicTerm.isActive, 1),
        ),
      )
      .limit(1),
    runtime.ORM.select({ id: academicAssessment.id })
      .from(academicAssessment)
      .where(
        and(
          eq(academicAssessment.organizationId, scope.organizationId),
          eq(academicAssessment.academicSessionId, scope.session.id),
          eq(academicAssessment.termId, data.termId),
          eq(academicAssessment.isActive, 1),
        ),
      ),
    runtime.ORM.select({ personId: studentEnrollment.personId })
      .from(studentEnrollment)
      .where(
        and(
          eq(studentEnrollment.organizationId, scope.organizationId),
          eq(studentEnrollment.academicSessionId, scope.session.id),
          eq(studentEnrollment.schoolId, data.schoolId),
          eq(studentEnrollment.academicClassId, data.academicClassId),
          inArray(studentEnrollment.status, ["recorded", "enrolled"]),
        ),
      ),
    runtime.ORM.select({ id: markSheet.id })
      .from(markSheet)
      .where(
        and(
          eq(markSheet.organizationId, scope.organizationId),
          eq(markSheet.academicSessionId, scope.session.id),
          eq(markSheet.schoolId, data.schoolId),
          eq(markSheet.academicClassId, data.academicClassId),
          eq(markSheet.subjectId, data.subjectId),
          eq(markSheet.termId, data.termId),
        ),
      )
      .limit(1),
    runtime.ORM.select({ subjectId: academicClassSubject.subjectId })
      .from(academicClassSubject)
      .where(
        and(
          eq(academicClassSubject.organizationId, scope.organizationId),
          eq(academicClassSubject.academicSessionId, scope.session.id),
          eq(academicClassSubject.academicClassId, data.academicClassId),
        ),
      ),
    runtime.ORM.select({
      assessmentId: academicClassSubjectAssessment.assessmentId,
      maximumMarks: academicClassSubjectAssessment.maximumMarks,
    })
      .from(academicClassSubjectAssessment)
      .where(
        and(
          eq(academicClassSubjectAssessment.organizationId, scope.organizationId),
          eq(academicClassSubjectAssessment.academicSessionId, scope.session.id),
          eq(academicClassSubjectAssessment.academicClassId, data.academicClassId),
          eq(academicClassSubjectAssessment.subjectId, data.subjectId),
        ),
      ),
  ]);
  const offering = offeringRows[0] ?? null;
  const subject = subjectRows[0] ?? null;
  const term = termRows[0] ?? null;
  const existing = existingRows[0] ?? null;
  if (!offering || !subject || !term)
    return Response.json({ error: "Choose valid result setup values." }, { status: 400 });
  if (
    configuredSubjects.length &&
    !configuredSubjects.some((row) => row.subjectId === data.subjectId)
  )
    return Response.json({ error: "That subject is not assigned to this class." }, { status: 400 });
  if (existing)
    return Response.json(
      { error: "A mark sheet already exists for this class, subject, and term.", id: existing.id },
      { status: 409 },
    );
  const assessmentIds = new Set(assessments.map((row) => row.id));
  const maximumByAssessment = new Map(
    configuredLimits
      .filter((row) => row.maximumMarks !== null)
      .map((row) => [row.assessmentId, Number(row.maximumMarks)]),
  );
  const rosterIds = new Set(roster.map((row) => row.personId));
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
  await runtime.ORM.batch([
    runtime.ORM.insert(markSheet).values({
      id: markSheetId,
      organizationId: scope.organizationId,
      academicSessionId: scope.session.id,
      schoolId: data.schoolId,
      academicClassId: data.academicClassId,
      subjectId: data.subjectId,
      termId: data.termId,
      recordedOn: data.recordedOn,
      isVerified: 0,
      status: "draft",
      maximumMarks: data.maximumMarks ?? null,
      sourceSystem: "tsewa",
      sourceTable: "mark_sheet",
      sourceId: markSheetId,
      createdByUserId: scope.userId,
      updatedByUserId: scope.userId,
    }),
    runtime.ORM.insert(studentMark).values(
      data.marks.map((mark) => {
        const id = crypto.randomUUID();
        return {
          id,
          organizationId: scope.organizationId,
          markSheetId,
          personId: mark.personId,
          assessmentId: mark.assessmentId,
          marks: mark.marks,
          maximumMarks: mark.maximumMarks,
          note: mark.note ?? null,
          sourceSystem: "tsewa",
          sourceTable: "student_mark",
          sourceId: id,
          createdByUserId: scope.userId,
          updatedByUserId: scope.userId,
        };
      }),
    ),
    auditInsert(runtime.ORM, scope, "academic.mark_sheet_created", "mark_sheet", markSheetId, {
      sessionId: scope.session.id,
      entryCount: String(data.marks.length),
    }),
  ]);
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
  const sheet = await runtime.ORM.select({
    id: markSheet.id,
    sessionId: markSheet.academicSessionId,
    schoolId: markSheet.schoolId,
    academicClassId: markSheet.academicClassId,
    subjectId: markSheet.subjectId,
    termId: markSheet.termId,
    recordedOn: markSheet.recordedOn,
    maximumMarks: markSheet.maximumMarks,
    status: markSheet.status,
    sourceSystem: markSheet.sourceSystem,
  })
    .from(markSheet)
    .where(and(eq(markSheet.id, markSheetId), eq(markSheet.organizationId, context.organizationId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!sheet) return Response.json({ error: "Mark sheet not found." }, { status: 404 });
  const marks = await runtime.ORM.select({
    id: studentMark.id,
    personId: studentMark.personId,
    assessmentId: studentMark.assessmentId,
    marks: studentMark.marks,
    maximumMarks: studentMark.maximumMarks,
    note: studentMark.note,
  })
    .from(studentMark)
    .where(
      and(
        eq(studentMark.organizationId, context.organizationId),
        eq(studentMark.markSheetId, markSheetId),
        eq(studentMark.isActive, 1),
      ),
    );
  return Response.json({
    sheet,
    marks,
    capabilities: {
      edit:
        hasPermission(context, "school.results.manage") &&
        sheet.status === "draft" &&
        isTsewaSource(sheet.sourceSystem),
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
  const sheet = await runtime.ORM.select({
    id: markSheet.id,
    status: markSheet.status,
    sourceSystem: markSheet.sourceSystem,
    schoolId: markSheet.schoolId,
    academicClassId: markSheet.academicClassId,
    subjectId: markSheet.subjectId,
    termId: markSheet.termId,
  })
    .from(markSheet)
    .where(
      and(
        eq(markSheet.id, markSheetId),
        eq(markSheet.organizationId, scope.organizationId),
        eq(markSheet.academicSessionId, scope.session.id),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!sheet) return Response.json({ error: "Mark sheet not found." }, { status: 404 });
  if (!isTsewaSource(sheet.sourceSystem) || sheet.status !== "draft")
    return Response.json({ error: "Only Tsewa draft mark sheets can be edited." }, { status: 409 });
  const data = parsed.data;
  if (
    sheet.schoolId !== data.schoolId ||
    sheet.academicClassId !== data.academicClassId ||
    sheet.subjectId !== data.subjectId ||
    sheet.termId !== data.termId
  )
    return Response.json({ error: "A mark sheet's scope cannot be changed." }, { status: 409 });

  const [assessments, roster, currentMarks, configuredLimits] = await runtime.ORM.batch([
    runtime.ORM.select({ id: academicAssessment.id })
      .from(academicAssessment)
      .where(
        and(
          eq(academicAssessment.organizationId, scope.organizationId),
          eq(academicAssessment.academicSessionId, scope.session.id),
          eq(academicAssessment.termId, data.termId),
          eq(academicAssessment.isActive, 1),
        ),
      ),
    runtime.ORM.select({ personId: studentEnrollment.personId })
      .from(studentEnrollment)
      .where(
        and(
          eq(studentEnrollment.organizationId, scope.organizationId),
          eq(studentEnrollment.academicSessionId, scope.session.id),
          eq(studentEnrollment.schoolId, data.schoolId),
          eq(studentEnrollment.academicClassId, data.academicClassId),
          inArray(studentEnrollment.status, ["recorded", "enrolled"]),
        ),
      ),
    runtime.ORM.select({
      id: studentMark.id,
      personId: studentMark.personId,
      assessmentId: studentMark.assessmentId,
    })
      .from(studentMark)
      .where(
        and(
          eq(studentMark.organizationId, scope.organizationId),
          eq(studentMark.markSheetId, markSheetId),
          eq(studentMark.isActive, 1),
        ),
      ),
    runtime.ORM.select({
      assessmentId: academicClassSubjectAssessment.assessmentId,
      maximumMarks: academicClassSubjectAssessment.maximumMarks,
    })
      .from(academicClassSubjectAssessment)
      .where(
        and(
          eq(academicClassSubjectAssessment.organizationId, scope.organizationId),
          eq(academicClassSubjectAssessment.academicSessionId, scope.session.id),
          eq(academicClassSubjectAssessment.academicClassId, data.academicClassId),
          eq(academicClassSubjectAssessment.subjectId, data.subjectId),
        ),
      ),
  ]);
  const assessmentIds = new Set(assessments.map((row) => row.id));
  const rosterIds = new Set(roster.map((row) => row.personId));
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
    configuredLimits
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
    currentMarks.map((mark) => [`${mark.personId}:${mark.assessmentId}`, mark]),
  );
  const submittedKeys = new Set(data.marks.map((mark) => `${mark.personId}:${mark.assessmentId}`));
  const sheetUpdate = runtime.ORM.update(markSheet)
    .set({
      recordedOn: data.recordedOn,
      maximumMarks: data.maximumMarks ?? null,
      updatedByUserId: scope.userId,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(and(eq(markSheet.id, markSheetId), eq(markSheet.organizationId, scope.organizationId)));
  const submittedMarks: Array<typeof studentMark.$inferInsert> = data.marks.map((mark) => {
    const key = `${mark.personId}:${mark.assessmentId}`;
    const existing = existingByKey.get(key);
    const id = existing?.id ?? crypto.randomUUID();
    return {
      id,
      organizationId: scope.organizationId,
      markSheetId,
      personId: mark.personId,
      assessmentId: mark.assessmentId,
      marks: mark.marks,
      maximumMarks: mark.maximumMarks,
      note: mark.note ?? null,
      isActive: 1,
      removedAt: null,
      sourceSystem: "tsewa",
      sourceTable: "student_mark",
      sourceId: id,
      createdByUserId: scope.userId,
      updatedByUserId: scope.userId,
    };
  });
  const submittedMarksUpsert = submittedMarks.length
    ? runtime.ORM.insert(studentMark)
        .values(submittedMarks)
        .onConflictDoUpdate({
          target: studentMark.id,
          set: {
            marks: sql`excluded.marks`,
            maximumMarks: sql`excluded.maximum_marks`,
            note: sql`excluded.note`,
            isActive: 1,
            removedAt: null,
            updatedByUserId: scope.userId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
    : null;
  const removedMarkIds = currentMarks
    .filter((mark) => !submittedKeys.has(`${mark.personId}:${mark.assessmentId}`))
    .map((mark) => mark.id);
  const removedMarksUpdate = removedMarkIds.length
    ? runtime.ORM.update(studentMark)
        .set({
          isActive: 0,
          removedAt: sql`CURRENT_TIMESTAMP`,
          updatedByUserId: scope.userId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(studentMark.organizationId, scope.organizationId),
            inArray(studentMark.id, removedMarkIds),
          ),
        )
    : null;
  const audit = auditInsert(
    runtime.ORM,
    scope,
    "academic.mark_sheet_updated",
    "mark_sheet",
    markSheetId,
    { entryCount: String(data.marks.length) },
  );
  if (submittedMarksUpsert && removedMarksUpdate) {
    await runtime.ORM.batch([sheetUpdate, submittedMarksUpsert, removedMarksUpdate, audit]);
  } else if (submittedMarksUpsert) {
    await runtime.ORM.batch([sheetUpdate, submittedMarksUpsert, audit]);
  } else if (removedMarksUpdate) {
    await runtime.ORM.batch([sheetUpdate, removedMarksUpdate, audit]);
  } else {
    await runtime.ORM.batch([sheetUpdate, audit]);
  }
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
  const conditions = [
    eq(markSheet.organizationId, context.organizationId),
    eq(markSheet.academicSessionId, sessionId),
    eq(studentMark.isActive, 1),
  ];
  if (school !== "all") conditions.push(eq(markSheet.schoolId, school));
  if (className !== "all") conditions.push(eq(markSheet.academicClassId, className));
  if (subject !== "all") conditions.push(eq(markSheet.subjectId, subject));
  if (term !== "all") conditions.push(eq(markSheet.termId, term));
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      or(
        sql`lower(${person.displayName}) LIKE ${search} ESCAPE '\\'`,
        sql`lower(${person.primaryIdentifier}) LIKE ${search} ESCAPE '\\'`,
      )!,
    );
  }
  const where = and(...conditions);
  const runtime = getRuntimeEnv();
  const groupedResults = runtime.ORM.select({ personId: person.id })
    .from(studentMark)
    .innerJoin(markSheet, eq(markSheet.id, studentMark.markSheetId))
    .innerJoin(
      person,
      and(
        eq(person.id, studentMark.personId),
        eq(person.organizationId, studentMark.organizationId),
      ),
    )
    .innerJoin(schoolMaster, eq(schoolMaster.id, markSheet.schoolId))
    .innerJoin(academicClassMaster, eq(academicClassMaster.id, markSheet.academicClassId))
    .innerJoin(academicTerm, eq(academicTerm.id, markSheet.termId))
    .where(where)
    .groupBy(
      person.id,
      person.displayName,
      person.primaryIdentifier,
      schoolMaster.id,
      schoolMaster.name,
      academicClassMaster.id,
      academicClassMaster.name,
      academicClassMaster.title,
      academicClassMaster.level,
      academicTerm.id,
      academicTerm.name,
    )
    .as("grouped_results");
  const [countRows, summaries] = await runtime.ORM.batch([
    runtime.ORM.select({ total: count() }).from(groupedResults),
    runtime.ORM.select({
      personId: person.id,
      studentName: person.displayName,
      admissionNumber: person.primaryIdentifier,
      schoolId: schoolMaster.id,
      schoolName: schoolMaster.name,
      academicClassId: academicClassMaster.id,
      className: sql<string>`case when ${academicClassMaster.section} is null or trim(${academicClassMaster.section}) = '' then ${academicClassMaster.name} else ${academicClassMaster.name} || ' · ' || ${academicClassMaster.section} end`,
      termId: academicTerm.id,
      termName: academicTerm.name,
      subjectCount: sql<number>`count(distinct ${markSheet.subjectId})`,
      totalMarks: sql<number>`sum(case when ${studentMark.marks} is not null then ${studentMark.marks} else 0 end)`,
      totalMaximum: sql<number>`sum(case when ${studentMark.marks} is not null then ${studentMark.maximumMarks} else 0 end)`,
      recordedCount: sql<number>`sum(case when ${studentMark.marks} is not null then 1 else 0 end)`,
      draftEntries: sql<number>`sum(case when ${markSheet.status} = 'draft' then 1 else 0 end)`,
      nonFinalEntries: sql<number>`sum(case when ${markSheet.status} <> 'final' then 1 else 0 end)`,
    })
      .from(studentMark)
      .innerJoin(markSheet, eq(markSheet.id, studentMark.markSheetId))
      .innerJoin(
        person,
        and(
          eq(person.id, studentMark.personId),
          eq(person.organizationId, studentMark.organizationId),
        ),
      )
      .innerJoin(schoolMaster, eq(schoolMaster.id, markSheet.schoolId))
      .innerJoin(academicClassMaster, eq(academicClassMaster.id, markSheet.academicClassId))
      .innerJoin(academicTerm, eq(academicTerm.id, markSheet.termId))
      .where(where)
      .groupBy(
        person.id,
        person.displayName,
        person.primaryIdentifier,
        schoolMaster.id,
        schoolMaster.name,
        academicClassMaster.id,
        academicClassMaster.name,
        academicClassMaster.section,
        academicClassMaster.title,
        academicClassMaster.level,
        academicTerm.id,
        academicTerm.name,
      )
      .orderBy(asc(sql`lower(${person.displayName})`), asc(sql`lower(${academicTerm.name})`))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const total = Number(countRows[0]?.total ?? 0);
  return Response.json({
    summaries: summaries.map((row) => ({
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
  const [organizationRows, sessionRows, studentRows, rows, grades] = await runtime.ORM.batch([
    runtime.ORM.select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, context.organizationId))
      .limit(1),
    runtime.ORM.select({
      id: academicSession.id,
      name: academicSession.name,
      startsOn: academicSession.startsOn,
      endsOn: academicSession.endsOn,
    })
      .from(academicSession)
      .where(
        and(
          eq(academicSession.id, parsed.data.sessionId),
          eq(academicSession.organizationId, context.organizationId),
        ),
      )
      .limit(1),
    runtime.ORM.select({
      personId: person.id,
      studentName: person.displayName,
      admissionNumber: person.primaryIdentifier,
      schoolName: schoolMaster.name,
      className: sql<string>`case when ${academicClassMaster.section} is null or trim(${academicClassMaster.section}) = '' then ${academicClassMaster.name} else ${academicClassMaster.name} || ' · ' || ${academicClassMaster.section} end`,
      termId: academicTerm.id,
      termName: academicTerm.name,
    })
      .from(studentMark)
      .innerJoin(markSheet, eq(markSheet.id, studentMark.markSheetId))
      .innerJoin(person, eq(person.id, studentMark.personId))
      .innerJoin(schoolMaster, eq(schoolMaster.id, markSheet.schoolId))
      .innerJoin(academicClassMaster, eq(academicClassMaster.id, markSheet.academicClassId))
      .innerJoin(academicTerm, eq(academicTerm.id, markSheet.termId))
      .where(
        and(
          eq(studentMark.organizationId, context.organizationId),
          eq(studentMark.personId, parsed.data.personId),
          eq(markSheet.academicSessionId, parsed.data.sessionId),
          eq(markSheet.termId, parsed.data.termId),
          eq(studentMark.isActive, 1),
        ),
      )
      .limit(1),
    runtime.ORM.select({
      subjectId: academicSubject.id,
      subjectName: academicSubject.name,
      gradeTypeId: academicSubject.gradeTypeId,
      passingPercentage: academicSubject.passingPercentage,
      assessmentId: academicAssessment.id,
      assessmentName: academicAssessment.name,
      marks: studentMark.marks,
      maximumMarks: studentMark.maximumMarks,
      note: studentMark.note,
      status: markSheet.status,
      sourceSystem: markSheet.sourceSystem,
    })
      .from(studentMark)
      .innerJoin(markSheet, eq(markSheet.id, studentMark.markSheetId))
      .innerJoin(academicSubject, eq(academicSubject.id, markSheet.subjectId))
      .innerJoin(academicAssessment, eq(academicAssessment.id, studentMark.assessmentId))
      .where(
        and(
          eq(studentMark.organizationId, context.organizationId),
          eq(studentMark.personId, parsed.data.personId),
          eq(markSheet.academicSessionId, parsed.data.sessionId),
          eq(markSheet.termId, parsed.data.termId),
          eq(studentMark.isActive, 1),
        ),
      )
      .orderBy(
        asc(sql`lower(${academicSubject.name})`),
        asc(sql`lower(${academicAssessment.name})`),
      ),
    runtime.ORM.select({
      gradeTypeId: academicGrade.gradeTypeId,
      name: academicGrade.name,
      startsAt: academicGrade.startsAt,
      endsAt: academicGrade.endsAt,
    })
      .from(academicGrade)
      .innerJoin(academicGradeType, eq(academicGradeType.id, academicGrade.gradeTypeId))
      .where(
        and(
          eq(academicGrade.organizationId, context.organizationId),
          eq(academicGradeType.academicSessionId, parsed.data.sessionId),
        ),
      )
      .orderBy(desc(academicGrade.startsAt)),
  ]);
  const organizationRecord = organizationRows[0] ?? null;
  const session = sessionRows[0] ?? null;
  const student = studentRows[0] ?? null;
  if (!session || !student || !rows.length)
    return Response.json(
      { error: "No result card was found for that selection." },
      { status: 404 },
    );
  return Response.json({
    generatedAt: new Date().toISOString(),
    organizationName: organizationRecord?.name ?? "School",
    session,
    student,
    results: rows,
    grades,
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
  const recordConditions = [eq(scholarshipRecord.organizationId, context.organizationId)];
  if (session !== "all") recordConditions.push(eq(scholarshipRecord.academicSessionId, session));
  const sessionRow =
    session === "all"
      ? null
      : await runtime.ORM.select({ name: academicSession.name })
          .from(academicSession)
          .where(
            and(
              eq(academicSession.id, session),
              eq(academicSession.organizationId, context.organizationId),
            ),
          )
          .limit(1)
          .then((values) => values[0] ?? null);
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
    const ledgerConditions = [eq(scholarshipSanction.organizationId, context.organizationId)];
    if (session !== "all")
      ledgerConditions.push(eq(scholarshipSanction.academicSessionId, session));
    rows = await runtime.ORM.select({
      sanctionedOn: scholarshipSanction.sanctionedOn,
      studentName: scholarshipRecord.studentName,
      admissionNumber: scholarshipRecord.admissionNumber,
      courseName: scholarshipCourse.name,
      headName: scholarshipHead.name,
      cityName: scholarshipSanctionLine.cityName,
      amount: scholarshipSanctionLine.amount,
      paymentReference: scholarshipSanction.paymentReference,
    })
      .from(scholarshipSanctionLine)
      .innerJoin(
        scholarshipSanction,
        eq(scholarshipSanction.id, scholarshipSanctionLine.sanctionId),
      )
      .innerJoin(scholarshipRecord, eq(scholarshipRecord.id, scholarshipSanction.scholarshipId))
      .leftJoin(scholarshipCourse, eq(scholarshipCourse.id, scholarshipRecord.courseId))
      .innerJoin(scholarshipHead, eq(scholarshipHead.id, scholarshipSanctionLine.headId))
      .where(and(...ledgerConditions))
      .orderBy(
        asc(scholarshipSanction.sanctionedOn),
        asc(sql`lower(${scholarshipRecord.studentName})`),
        asc(sql`lower(${scholarshipHead.name})`),
      );
  } else if (report === "placeWise") {
    title = "Scholarship students · place-wise";
    columns = [
      { key: "cityName", label: "Place" },
      { key: "students", label: "Students", numeric: true },
      { key: "awardedAmount", label: "Awarded", numeric: true },
      { key: "sanctionedAmount", label: "Sanctioned", numeric: true },
    ];
    const sanctionTotals = runtime.ORM.select({
      scholarshipId: scholarshipSanction.scholarshipId,
      amount: sql<number>`sum(${scholarshipSanction.amount})`.as("amount"),
    })
      .from(scholarshipSanction)
      .groupBy(scholarshipSanction.scholarshipId)
      .as("sanction_totals");
    const cityName = sql<string>`coalesce(${scholarshipRecord.cityName}, 'Not recorded')`;
    rows = await runtime.ORM.select({
      cityName,
      students: count(),
      awardedAmount: sql<number>`coalesce(sum(${scholarshipRecord.scholarshipAwarded}), 0)`,
      sanctionedAmount: sql<number>`coalesce(sum(${sanctionTotals.amount}), 0)`,
    })
      .from(scholarshipRecord)
      .leftJoin(sanctionTotals, eq(sanctionTotals.scholarshipId, scholarshipRecord.id))
      .where(and(...recordConditions))
      .groupBy(cityName)
      .orderBy(desc(count()), asc(sql`lower(${cityName})`));
  } else if (report === "yearWise") {
    title = "Scholarship students · year-wise";
    columns = [
      { key: "courseCategory", label: "Category" },
      { key: "courseName", label: "Course" },
      { key: "studyYear", label: "Study year" },
      { key: "students", label: "Students", numeric: true },
    ];
    const rankedAnnual = runtime.ORM.select({
      scholarshipId: scholarshipAnnualDetail.scholarshipId,
      studyYear: scholarshipAnnualDetail.studyYear,
      rank: sql<number>`row_number() over (partition by ${scholarshipAnnualDetail.scholarshipId} order by ${scholarshipAnnualDetail.createdAt} desc, ${scholarshipAnnualDetail.id} desc)`.as(
        "annual_rank",
      ),
    })
      .from(scholarshipAnnualDetail)
      .as("ranked_annual");
    const latestAnnual = runtime.ORM.select({
      scholarshipId: rankedAnnual.scholarshipId,
      studyYear: rankedAnnual.studyYear,
    })
      .from(rankedAnnual)
      .where(eq(rankedAnnual.rank, 1))
      .as("latest_annual");
    const courseCategory = sql<string>`coalesce(${scholarshipCourseCategory.name}, 'Uncategorised')`;
    const courseName = sql<string>`coalesce(${scholarshipCourse.name}, 'Course not recorded')`;
    const studyYear = sql<string>`coalesce(${latestAnnual.studyYear}, 'Not recorded')`;
    rows = await runtime.ORM.select({ courseCategory, courseName, studyYear, students: count() })
      .from(scholarshipRecord)
      .leftJoin(scholarshipCourse, eq(scholarshipCourse.id, scholarshipRecord.courseId))
      .leftJoin(
        scholarshipCourseCategory,
        eq(scholarshipCourseCategory.id, scholarshipCourse.categoryId),
      )
      .leftJoin(latestAnnual, eq(latestAnnual.scholarshipId, scholarshipRecord.id))
      .where(and(...recordConditions))
      .groupBy(courseCategory, courseName, studyYear)
      .orderBy(
        asc(sql`lower(${courseCategory})`),
        asc(sql`lower(${courseName})`),
        asc(sql`lower(${studyYear})`),
      );
  } else {
    if (report === "courseCompleted")
      recordConditions.push(
        eq(scholarshipRecord.status, "closed"),
        eq(sql`lower(coalesce(${scholarshipRecord.reason}, ''))`, "course completed"),
      );
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
    rows = await runtime.ORM.select({
      studentName: scholarshipRecord.studentName,
      admissionNumber: scholarshipRecord.admissionNumber,
      courseName: scholarshipCourse.name,
      instituteName: scholarshipRecord.instituteName,
      cityName: scholarshipRecord.cityName,
      status: scholarshipRecord.status,
      scholarshipAwarded: scholarshipRecord.scholarshipAwarded,
    })
      .from(scholarshipRecord)
      .leftJoin(scholarshipCourse, eq(scholarshipCourse.id, scholarshipRecord.courseId))
      .where(and(...recordConditions))
      .orderBy(asc(sql`lower(${scholarshipRecord.studentName})`));
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
  const conditions = [eq(scholarshipRecord.organizationId, context.organizationId)];
  if (status !== "all") conditions.push(eq(scholarshipRecord.status, status));
  if (course !== "all") conditions.push(eq(scholarshipRecord.courseId, course));
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      or(
        sql`lower(${scholarshipRecord.studentName}) LIKE ${search} ESCAPE '\\'`,
        sql`lower(coalesce(${scholarshipRecord.admissionNumber}, '')) LIKE ${search} ESCAPE '\\'`,
        sql`lower(coalesce(${scholarshipRecord.instituteName}, '')) LIKE ${search} ESCAPE '\\'`,
      )!,
    );
  }
  const where = and(...conditions);
  const runtime = getRuntimeEnv();
  const [countRows, scholarshipSummary, sanctionSummary, rows] = await runtime.ORM.batch([
    runtime.ORM.select({ total: count() }).from(scholarshipRecord).where(where),
    runtime.ORM.select({
      scholarships: count(),
      active: sql<number>`sum(case when ${scholarshipRecord.status} = 'active' then 1 else 0 end)`,
    })
      .from(scholarshipRecord)
      .where(eq(scholarshipRecord.organizationId, context.organizationId)),
    runtime.ORM.select({
      sanctions: count(),
      sanctionedAmount: sql<number>`coalesce(sum(${scholarshipSanction.amount}), 0)`,
    })
      .from(scholarshipSanction)
      .where(eq(scholarshipSanction.organizationId, context.organizationId)),
    runtime.ORM.select({
      id: scholarshipRecord.id,
      personId: scholarshipRecord.personId,
      studentName: scholarshipRecord.studentName,
      admissionNumber: scholarshipRecord.admissionNumber,
      beneficiaryCategory: scholarshipRecord.beneficiaryCategory,
      instituteName: scholarshipRecord.instituteName,
      cityName: scholarshipRecord.cityName,
      status: scholarshipRecord.status,
      admissionYear: scholarshipRecord.admissionYear,
      courseDuration: scholarshipRecord.courseDuration,
      courseName: scholarshipCourse.name,
      courseCategory: scholarshipCourseCategory.name,
    })
      .from(scholarshipRecord)
      .leftJoin(scholarshipCourse, eq(scholarshipCourse.id, scholarshipRecord.courseId))
      .leftJoin(
        scholarshipCourseCategory,
        eq(scholarshipCourseCategory.id, scholarshipCourse.categoryId),
      )
      .where(where)
      .orderBy(asc(sql`lower(${scholarshipRecord.studentName})`))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const recordIds = rows.map((row) => row.id);
  const [annualCounts, sanctionAggregates] = recordIds.length
    ? await runtime.ORM.batch([
        runtime.ORM.select({ scholarshipId: scholarshipAnnualDetail.scholarshipId, count: count() })
          .from(scholarshipAnnualDetail)
          .where(inArray(scholarshipAnnualDetail.scholarshipId, recordIds))
          .groupBy(scholarshipAnnualDetail.scholarshipId),
        runtime.ORM.select({
          scholarshipId: scholarshipSanction.scholarshipId,
          count: count(),
          sanctionedAmount: sql<number>`coalesce(sum(${scholarshipSanction.amount}), 0)`,
          lastSanctionOn: sql<string | null>`max(${scholarshipSanction.sanctionedOn})`,
        })
          .from(scholarshipSanction)
          .where(inArray(scholarshipSanction.scholarshipId, recordIds))
          .groupBy(scholarshipSanction.scholarshipId),
      ])
    : [[], []];
  const annualByRecord = new Map(annualCounts.map((item) => [item.scholarshipId, item.count]));
  const sanctionsByRecord = new Map(sanctionAggregates.map((item) => [item.scholarshipId, item]));
  const total = Number(countRows[0]?.total ?? 0);
  const summary = scholarshipSummary[0];
  const sanctions = sanctionSummary[0];
  return Response.json({
    summary: {
      scholarships: Number(summary?.scholarships ?? 0),
      active: Number(summary?.active ?? 0),
      sanctions: Number(sanctions?.sanctions ?? 0),
      sanctionedAmount: Number(sanctions?.sanctionedAmount ?? 0),
    },
    scholarships: rows.map((row) => {
      const sanction = sanctionsByRecord.get(row.id);
      return {
        ...row,
        annualDetailCount: annualByRecord.get(row.id) ?? 0,
        sanctionCount: sanction?.count ?? 0,
        sanctionedAmount: sanction?.sanctionedAmount ?? 0,
        lastSanctionOn: sanction?.lastSanctionOn ?? null,
      };
    }),
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
  if (!(await validScholarshipReferences(runtime.ORM, context.organizationId, parsed.data)))
    return Response.json({ error: "Choose a valid person, session, and course." }, { status: 400 });
  const id = crypto.randomUUID();
  await runtime.ORM.batch([
    scholarshipRecordWrite(runtime.ORM, "insert", context, id, parsed.data),
    auditInsert(runtime.ORM, context, "scholarship.record_created", "scholarship_record", id),
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
  const record = await runtime.ORM.select({
    ...getTableColumns(scholarshipRecord),
    sessionId: scholarshipRecord.academicSessionId,
    courseName: scholarshipCourse.name,
    courseCategory: scholarshipCourseCategory.name,
  })
    .from(scholarshipRecord)
    .leftJoin(scholarshipCourse, eq(scholarshipCourse.id, scholarshipRecord.courseId))
    .leftJoin(
      scholarshipCourseCategory,
      eq(scholarshipCourseCategory.id, scholarshipCourse.categoryId),
    )
    .where(
      and(
        eq(scholarshipRecord.id, scholarshipId),
        eq(scholarshipRecord.organizationId, context.organizationId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!record) return Response.json({ error: "Scholarship record not found." }, { status: 404 });
  const [annual, sanctions, sanctionLines] = await runtime.ORM.batch([
    runtime.ORM.select({
      id: scholarshipAnnualDetail.id,
      sessionId: scholarshipAnnualDetail.academicSessionId,
      studyYear: scholarshipAnnualDetail.studyYear,
      passed: scholarshipAnnualDetail.passed,
      percentage: scholarshipAnnualDetail.percentage,
      division: scholarshipAnnualDetail.division,
      fees: scholarshipAnnualDetail.fees,
      remarks: scholarshipAnnualDetail.remarks,
      sourceSystem: scholarshipAnnualDetail.sourceSystem,
    })
      .from(scholarshipAnnualDetail)
      .where(
        and(
          eq(scholarshipAnnualDetail.organizationId, context.organizationId),
          eq(scholarshipAnnualDetail.scholarshipId, scholarshipId),
        ),
      )
      .orderBy(asc(scholarshipAnnualDetail.studyYear), asc(scholarshipAnnualDetail.createdAt)),
    runtime.ORM.select({
      id: scholarshipSanction.id,
      sessionId: scholarshipSanction.academicSessionId,
      amount: scholarshipSanction.amount,
      sanctionedOn: scholarshipSanction.sanctionedOn,
      periodFrom: scholarshipSanction.periodFrom,
      periodTo: scholarshipSanction.periodTo,
      paymentReference: scholarshipSanction.paymentReference,
      inFavourOf: scholarshipSanction.inFavourOf,
      remarks: scholarshipSanction.remarks,
      sourceSystem: scholarshipSanction.sourceSystem,
    })
      .from(scholarshipSanction)
      .where(
        and(
          eq(scholarshipSanction.organizationId, context.organizationId),
          eq(scholarshipSanction.scholarshipId, scholarshipId),
        ),
      )
      .orderBy(desc(scholarshipSanction.sanctionedOn)),
    runtime.ORM.select({
      id: scholarshipSanctionLine.id,
      sanctionId: scholarshipSanctionLine.sanctionId,
      headId: scholarshipHead.id,
      headName: scholarshipHead.name,
      cityName: scholarshipSanctionLine.cityName,
      amount: scholarshipSanctionLine.amount,
      advanceOn: scholarshipSanctionLine.advanceOn,
    })
      .from(scholarshipSanctionLine)
      .innerJoin(scholarshipHead, eq(scholarshipHead.id, scholarshipSanctionLine.headId))
      .where(
        and(
          eq(scholarshipSanctionLine.organizationId, context.organizationId),
          eq(scholarshipSanctionLine.scholarshipId, scholarshipId),
        ),
      ),
  ]);
  return Response.json({
    record: {
      ...record,
      collegeTraining: Boolean(record.collegeTraining),
      specialAllowance: Boolean(record.specialAllowance),
    },
    annualDetails: annual.map((item) => ({ ...item, passed: Boolean(item.passed) })),
    sanctions: sanctions.map((item) => ({
      ...item,
      lines: sanctionLines.filter((line) => line.sanctionId === item.id),
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
  const exists = await runtime.ORM.select({
    id: scholarshipRecord.id,
    personId: scholarshipRecord.personId,
  })
    .from(scholarshipRecord)
    .where(
      and(
        eq(scholarshipRecord.id, scholarshipId),
        eq(scholarshipRecord.organizationId, context.organizationId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!exists) return Response.json({ error: "Scholarship record not found." }, { status: 404 });
  if (parsed.data.action === "record") {
    if (!(await validScholarshipReferences(runtime.ORM, context.organizationId, parsed.data.value)))
      return Response.json(
        { error: "Choose a valid person, session, and course." },
        { status: 400 },
      );
    await runtime.ORM.batch([
      scholarshipRecordWrite(runtime.ORM, "update", context, scholarshipId, parsed.data.value),
      auditInsert(
        runtime.ORM,
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
      !(await scholarshipSessionExists(runtime.ORM, context.organizationId, value.sessionId))
    )
      return Response.json({ error: "Choose a valid academic session." }, { status: 400 });
    const id = value.id ?? crypto.randomUUID();
    const existing = value.id
      ? await runtime.ORM.select({ id: scholarshipAnnualDetail.id })
          .from(scholarshipAnnualDetail)
          .where(
            and(
              eq(scholarshipAnnualDetail.id, value.id),
              eq(scholarshipAnnualDetail.organizationId, context.organizationId),
              eq(scholarshipAnnualDetail.scholarshipId, scholarshipId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;
    if (value.id && !existing)
      return Response.json({ error: "Annual detail not found." }, { status: 404 });
    const annualValues = {
      academicSessionId: value.sessionId ?? null,
      studyYear: value.studyYear,
      passed: value.passed ? 1 : 0,
      percentage: value.percentage ?? null,
      division: value.division ?? null,
      fees: value.fees ?? null,
      remarks: value.remarks ?? null,
    };
    const statement = existing
      ? runtime.ORM.update(scholarshipAnnualDetail)
          .set({
            ...annualValues,
            updatedByUserId: context.userId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(scholarshipAnnualDetail.id, id),
              eq(scholarshipAnnualDetail.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(scholarshipAnnualDetail).values({
          id,
          organizationId: context.organizationId,
          scholarshipId,
          ...annualValues,
          sourceSystem: "tsewa",
          sourceTable: "scholarship_annual_detail",
          sourceId: id,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
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
      !(await scholarshipSessionExists(runtime.ORM, context.organizationId, value.sessionId))
    )
      return Response.json({ error: "Choose a valid academic session." }, { status: 400 });
    const headRows = await runtime.ORM.select({ id: scholarshipHead.id })
      .from(scholarshipHead)
      .where(
        and(
          eq(scholarshipHead.organizationId, context.organizationId),
          eq(scholarshipHead.isActive, 1),
        ),
      );
    const headIds = new Set(headRows.map((item) => item.id));
    if (value.lines.some((line) => !headIds.has(line.headId)))
      return Response.json({ error: "Choose valid scholarship heads." }, { status: 400 });
    const id = value.id ?? crypto.randomUUID();
    const existing = value.id
      ? await runtime.ORM.select({ id: scholarshipSanction.id })
          .from(scholarshipSanction)
          .where(
            and(
              eq(scholarshipSanction.id, value.id),
              eq(scholarshipSanction.organizationId, context.organizationId),
              eq(scholarshipSanction.scholarshipId, scholarshipId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : null;
    if (value.id && !existing)
      return Response.json({ error: "Sanction not found." }, { status: 404 });
    const sanctionValues = {
      academicSessionId: value.sessionId ?? null,
      amount: value.amount,
      sanctionedOn: value.sanctionedOn,
      periodFrom: value.periodFrom ?? null,
      periodTo: value.periodTo ?? null,
      paymentReference: value.paymentReference ?? null,
      inFavourOf: value.inFavourOf ?? null,
      remarks: value.remarks ?? null,
    };
    const sanctionStatement = existing
      ? runtime.ORM.update(scholarshipSanction)
          .set({
            ...sanctionValues,
            updatedByUserId: context.userId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(scholarshipSanction.id, id),
              eq(scholarshipSanction.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(scholarshipSanction).values({
          id,
          organizationId: context.organizationId,
          scholarshipId,
          ...sanctionValues,
          sourceSystem: "tsewa",
          sourceTable: "scholarship_sanction",
          sourceId: id,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
        });
    const deleteLinesStatement = runtime.ORM.delete(scholarshipSanctionLine).where(
      and(
        eq(scholarshipSanctionLine.organizationId, context.organizationId),
        eq(scholarshipSanctionLine.sanctionId, id),
      ),
    );
    const audit = auditInsert(
      runtime.ORM,
      context,
      existing ? "scholarship.sanction_updated" : "scholarship.sanction_created",
      "scholarship_sanction",
      id,
      { scholarshipId, lineCount: String(value.lines.length) },
    );
    if (value.lines.length > 0) {
      const insertLinesStatement = runtime.ORM.insert(scholarshipSanctionLine).values(
        value.lines.map((line) => {
          const lineId = crypto.randomUUID();
          return {
            id: lineId,
            organizationId: context.organizationId,
            sanctionId: id,
            scholarshipId,
            personId: exists.personId,
            headId: line.headId,
            cityName: line.cityName ?? null,
            amount: line.amount,
            advanceOn: line.advanceOn ?? null,
            sourceSystem: "tsewa",
            sourceTable: "scholarship_sanction_line",
            sourceId: lineId,
            createdByUserId: context.userId,
            updatedByUserId: context.userId,
          };
        }),
      );
      await runtime.ORM.batch([
        sanctionStatement,
        deleteLinesStatement,
        insertLinesStatement,
        audit,
      ]);
    } else {
      await runtime.ORM.batch([sanctionStatement, deleteLinesStatement, audit]);
    }
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
    const personSearch = q
      ? or(
          sql`lower(${person.displayName}) LIKE ${search} ESCAPE '\\'`,
          sql`lower(coalesce(${person.primaryIdentifier}, '')) LIKE ${search} ESCAPE '\\'`,
        )
      : undefined;
    const [categories, courses, heads, limits, advances, sessions, people] =
      await runtime.ORM.batch([
        runtime.ORM.select({
          id: scholarshipCourseCategory.id,
          name: scholarshipCourseCategory.name,
          isActive: scholarshipCourseCategory.isActive,
        })
          .from(scholarshipCourseCategory)
          .where(eq(scholarshipCourseCategory.organizationId, context.organizationId))
          .orderBy(asc(sql`lower(${scholarshipCourseCategory.name})`)),
        runtime.ORM.select({
          id: scholarshipCourse.id,
          categoryId: scholarshipCourse.categoryId,
          name: scholarshipCourse.name,
          isActive: scholarshipCourse.isActive,
        })
          .from(scholarshipCourse)
          .where(eq(scholarshipCourse.organizationId, context.organizationId))
          .orderBy(asc(sql`lower(${scholarshipCourse.name})`)),
        runtime.ORM.select({
          id: scholarshipHead.id,
          name: scholarshipHead.name,
          isActive: scholarshipHead.isActive,
        })
          .from(scholarshipHead)
          .where(eq(scholarshipHead.organizationId, context.organizationId))
          .orderBy(asc(sql`lower(${scholarshipHead.name})`)),
        runtime.ORM.select({
          id: scholarshipLimit.id,
          courseGroup: scholarshipLimit.courseGroup,
          headName: scholarshipLimit.headName,
          amount: scholarshipLimit.amount,
          isActive: scholarshipLimit.isActive,
        })
          .from(scholarshipLimit)
          .where(eq(scholarshipLimit.organizationId, context.organizationId))
          .orderBy(asc(scholarshipLimit.courseGroup), asc(scholarshipLimit.headName)),
        runtime.ORM.select({
          id: scholarshipCityAdvance.id,
          sessionId: scholarshipCityAdvance.academicSessionId,
          cityName: scholarshipCityAdvance.cityName,
          amount: scholarshipCityAdvance.amount,
        })
          .from(scholarshipCityAdvance)
          .where(eq(scholarshipCityAdvance.organizationId, context.organizationId))
          .orderBy(asc(scholarshipCityAdvance.cityName)),
        runtime.ORM.select({ id: academicSession.id, name: academicSession.name })
          .from(academicSession)
          .where(eq(academicSession.organizationId, context.organizationId))
          .orderBy(desc(academicSession.startsOn)),
        runtime.ORM.select({
          id: person.id,
          name: person.displayName,
          admissionNumber: person.primaryIdentifier,
        })
          .from(person)
          .where(
            and(
              eq(person.organizationId, context.organizationId),
              eq(person.status, "active"),
              personSearch,
            ),
          )
          .orderBy(asc(sql`lower(${person.displayName})`))
          .limit(30),
      ]);
    return Response.json({
      categories,
      courses,
      heads,
      limits,
      cityAdvances: advances,
      sessions,
      people,
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
    const category = await runtime.ORM.select({ id: scholarshipCourseCategory.id })
      .from(scholarshipCourseCategory)
      .where(
        and(
          eq(scholarshipCourseCategory.id, value.categoryId),
          eq(scholarshipCourseCategory.organizationId, context.organizationId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!category)
      return Response.json({ error: "Choose a valid course category." }, { status: 400 });
  }
  if (
    value.kind === "cityAdvance" &&
    value.sessionId &&
    !(await scholarshipSessionExists(runtime.ORM, context.organizationId, value.sessionId))
  )
    return Response.json({ error: "Choose a valid academic session." }, { status: 400 });
  const id = value.id ?? crypto.randomUUID();
  const sourceValues = {
    id,
    organizationId: context.organizationId,
    sourceSystem: "tsewa",
    sourceId: id,
    createdByUserId: context.userId,
    updatedByUserId: context.userId,
  };
  let existing = false;
  let tableName: string;
  if (value.kind === "courseCategory") {
    tableName = "scholarship_course_category";
    existing = Boolean(
      value.id &&
      (
        await runtime.ORM.select({ id: scholarshipCourseCategory.id })
          .from(scholarshipCourseCategory)
          .where(
            and(
              eq(scholarshipCourseCategory.id, id),
              eq(scholarshipCourseCategory.organizationId, context.organizationId),
            ),
          )
          .limit(1)
      )[0],
    );
    if (value.id && !existing)
      return Response.json({ error: "Setup record not found." }, { status: 404 });
    const statement = existing
      ? runtime.ORM.update(scholarshipCourseCategory)
          .set({
            name: value.name,
            updatedByUserId: context.userId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(scholarshipCourseCategory.id, id),
              eq(scholarshipCourseCategory.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(scholarshipCourseCategory).values({
          ...sourceValues,
          name: value.name,
          sourceTable: tableName,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
        context,
        `scholarship.${value.kind}_${existing ? "updated" : "created"}`,
        tableName,
        id,
      ),
    ]);
  } else if (value.kind === "course") {
    tableName = "scholarship_course";
    existing = Boolean(
      value.id &&
      (
        await runtime.ORM.select({ id: scholarshipCourse.id })
          .from(scholarshipCourse)
          .where(
            and(
              eq(scholarshipCourse.id, id),
              eq(scholarshipCourse.organizationId, context.organizationId),
            ),
          )
          .limit(1)
      )[0],
    );
    if (value.id && !existing)
      return Response.json({ error: "Setup record not found." }, { status: 404 });
    const values = { categoryId: value.categoryId ?? null, name: value.name };
    const statement = existing
      ? runtime.ORM.update(scholarshipCourse)
          .set({ ...values, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(
            and(
              eq(scholarshipCourse.id, id),
              eq(scholarshipCourse.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(scholarshipCourse).values({
          ...sourceValues,
          ...values,
          sourceTable: tableName,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
        context,
        `scholarship.${value.kind}_${existing ? "updated" : "created"}`,
        tableName,
        id,
      ),
    ]);
  } else if (value.kind === "head") {
    tableName = "scholarship_head";
    existing = Boolean(
      value.id &&
      (
        await runtime.ORM.select({ id: scholarshipHead.id })
          .from(scholarshipHead)
          .where(
            and(
              eq(scholarshipHead.id, id),
              eq(scholarshipHead.organizationId, context.organizationId),
            ),
          )
          .limit(1)
      )[0],
    );
    if (value.id && !existing)
      return Response.json({ error: "Setup record not found." }, { status: 404 });
    const statement = existing
      ? runtime.ORM.update(scholarshipHead)
          .set({
            name: value.name,
            updatedByUserId: context.userId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(scholarshipHead.id, id),
              eq(scholarshipHead.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(scholarshipHead).values({
          ...sourceValues,
          name: value.name,
          sourceTable: tableName,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
        context,
        `scholarship.${value.kind}_${existing ? "updated" : "created"}`,
        tableName,
        id,
      ),
    ]);
  } else if (value.kind === "limit") {
    tableName = "scholarship_limit";
    existing = Boolean(
      value.id &&
      (
        await runtime.ORM.select({ id: scholarshipLimit.id })
          .from(scholarshipLimit)
          .where(
            and(
              eq(scholarshipLimit.id, id),
              eq(scholarshipLimit.organizationId, context.organizationId),
            ),
          )
          .limit(1)
      )[0],
    );
    if (value.id && !existing)
      return Response.json({ error: "Setup record not found." }, { status: 404 });
    const values = {
      courseGroup: value.courseGroup,
      headName: value.headName,
      amount: value.amount ?? null,
    };
    const statement = existing
      ? runtime.ORM.update(scholarshipLimit)
          .set({ ...values, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(
            and(
              eq(scholarshipLimit.id, id),
              eq(scholarshipLimit.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(scholarshipLimit).values({
          ...sourceValues,
          ...values,
          sourceTable: tableName,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
        context,
        `scholarship.${value.kind}_${existing ? "updated" : "created"}`,
        tableName,
        id,
      ),
    ]);
  } else {
    tableName = "scholarship_city_advance";
    existing = Boolean(
      value.id &&
      (
        await runtime.ORM.select({ id: scholarshipCityAdvance.id })
          .from(scholarshipCityAdvance)
          .where(
            and(
              eq(scholarshipCityAdvance.id, id),
              eq(scholarshipCityAdvance.organizationId, context.organizationId),
            ),
          )
          .limit(1)
      )[0],
    );
    if (value.id && !existing)
      return Response.json({ error: "Setup record not found." }, { status: 404 });
    const values = {
      academicSessionId: value.sessionId ?? null,
      cityName: value.cityName,
      amount: value.amount,
    };
    const statement = existing
      ? runtime.ORM.update(scholarshipCityAdvance)
          .set({ ...values, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(
            and(
              eq(scholarshipCityAdvance.id, id),
              eq(scholarshipCityAdvance.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(scholarshipCityAdvance).values({
          ...sourceValues,
          ...values,
          sourceTable: tableName,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
        context,
        `scholarship.${value.kind}_${existing ? "updated" : "created"}`,
        tableName,
        id,
      ),
    ]);
  }
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
      : await runtime.ORM.select({ name: academicSession.name })
          .from(academicSession)
          .where(
            and(
              eq(academicSession.id, session),
              eq(academicSession.organizationId, context.organizationId),
            ),
          )
          .limit(1)
          .then((results) => results[0]);
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
    const parent = alias(sponsorshipOrganization, "report_sponsor_parent");
    const groupExpression = byHome
      ? sql<string>`coalesce(${personPlacement.homeName}, 'No current home')`
      : sql<string>`coalesce(${parent.name}, 'Independent sponsors')`;
    const conditions = [eq(sponsorshipAssignment.organizationId, context.organizationId)];
    if (session !== "all") conditions.push(eq(sponsorshipAssignment.academicSessionId, session));
    const result = await runtime.ORM.select({
      groupName: groupExpression,
      beneficiaries: sql<number>`count(distinct ${sponsorshipAssignment.personId})`,
      sponsors: sql<number>`count(distinct ${sponsorshipAssignment.sponsorIndividualId})`,
      approved: sql<number>`sum(case when lower(${sponsorshipStatus.name}) = 'approved' then 1 else 0 end)`,
      latestStatusOn: sql<string | null>`max(${sponsorshipAssignment.statusOn})`,
    })
      .from(sponsorshipAssignment)
      .innerJoin(
        sponsorshipIndividual,
        eq(sponsorshipIndividual.id, sponsorshipAssignment.sponsorIndividualId),
      )
      .innerJoin(
        sponsorshipStatus,
        eq(sponsorshipStatus.id, sponsorshipAssignment.sponsorshipStatusId),
      )
      .leftJoin(parent, eq(parent.id, sponsorshipIndividual.sponsorOrganizationId))
      .leftJoin(
        personPlacement,
        and(
          eq(personPlacement.personId, sponsorshipAssignment.personId),
          eq(personPlacement.organizationId, sponsorshipAssignment.organizationId),
          eq(personPlacement.isCurrent, 1),
        ),
      )
      .where(and(...conditions))
      .groupBy(groupExpression)
      .orderBy(desc(sql`count(distinct ${sponsorshipAssignment.personId})`), sql`1 collate nocase`);
    const groupKey = byHome ? "homeName" : "organizationName";
    rows = result.map(({ groupName, ...row }) => ({ [groupKey]: groupName, ...row }));
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
    const assignmentCounts = runtime.ORM.select({
      sponsorId: sponsorshipAssignment.sponsorIndividualId,
      beneficiaries: count().as("beneficiaries"),
    })
      .from(sponsorshipAssignment)
      .groupBy(sponsorshipAssignment.sponsorIndividualId)
      .as("report_assignment_counts");
    rows = await runtime.ORM.select({
      sponsorName: sponsorshipIndividual.displayName,
      organizationName: sponsorshipOrganization.name,
      categoryName: sponsorshipSponsorCategory.name,
      address: sponsorshipIndividual.address,
      countryName: sponsorshipIndividual.countryName,
      email: sponsorshipIndividual.email,
      phone: sponsorshipIndividual.phone,
      beneficiaries: sql<number>`coalesce(${assignmentCounts.beneficiaries}, 0)`,
    })
      .from(sponsorshipIndividual)
      .leftJoin(
        sponsorshipOrganization,
        eq(sponsorshipOrganization.id, sponsorshipIndividual.sponsorOrganizationId),
      )
      .leftJoin(
        sponsorshipSponsorCategory,
        eq(sponsorshipSponsorCategory.id, sponsorshipIndividual.sponsorCategoryId),
      )
      .leftJoin(assignmentCounts, eq(assignmentCounts.sponsorId, sponsorshipIndividual.id))
      .where(eq(sponsorshipIndividual.organizationId, context.organizationId))
      .orderBy(sql`${sponsorshipIndividual.displayName} collate nocase`);
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
    const conditions = [
      eq(sponsorshipAssignment.organizationId, context.organizationId),
      eq(person.kind, elderly ? "elderly" : "child"),
    ];
    if (session !== "all") conditions.push(eq(sponsorshipAssignment.academicSessionId, session));
    if (!caseHistory)
      conditions.push(
        inArray(sql<string>`lower(${sponsorshipStatus.name})`, [
          "discontinued",
          "rejected",
          "continued",
        ]),
      );
    rows = await runtime.ORM.select({
      beneficiaryName: person.displayName,
      identifier: person.primaryIdentifier,
      homeName: personPlacement.homeName,
      sponsorName: sponsorshipIndividual.displayName,
      statusName: sponsorshipStatus.name,
      statusOn: sponsorshipAssignment.statusOn,
      remarks: sponsorshipAssignment.remarks,
    })
      .from(sponsorshipAssignment)
      .innerJoin(person, eq(person.id, sponsorshipAssignment.personId))
      .innerJoin(
        sponsorshipIndividual,
        eq(sponsorshipIndividual.id, sponsorshipAssignment.sponsorIndividualId),
      )
      .innerJoin(
        sponsorshipStatus,
        eq(sponsorshipStatus.id, sponsorshipAssignment.sponsorshipStatusId),
      )
      .leftJoin(
        personPlacement,
        and(
          eq(personPlacement.personId, person.id),
          eq(personPlacement.organizationId, person.organizationId),
          eq(personPlacement.isCurrent, 1),
        ),
      )
      .where(and(...conditions))
      .orderBy(sql`${person.displayName} collate nocase`, desc(sponsorshipAssignment.statusOn));
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
    const conditions = [eq(sponsorshipFund.organizationId, context.organizationId)];
    if (session !== "all") conditions.push(eq(sponsorshipFund.academicSessionId, session));
    if (report === "giftMoney")
      conditions.push(eq(sql<string>`lower(${sponsorshipFundType.name})`, "gift money"));
    rows = await runtime.ORM.select({
      receivedOn: sponsorshipFund.receivedOn,
      sponsorName: sql<string>`coalesce(${sponsorshipIndividual.displayName}, ${sponsorshipOrganization.name}, ${sponsorshipVisitor.displayName}, 'Legacy sponsor')`,
      fundType: sponsorshipFundType.name,
      receiptNumber: sponsorshipFund.receiptNumber,
      amount: sponsorshipFund.amount,
      allocatedAmount: sql<number>`coalesce(sum(${sponsorshipFundAllocation.amount}), 0)`,
      beneficiaries: sql<number>`count(distinct ${sponsorshipFundAllocation.personId})`,
      remarks: sponsorshipFund.remarks,
    })
      .from(sponsorshipFund)
      .innerJoin(sponsorshipFundType, eq(sponsorshipFundType.id, sponsorshipFund.fundTypeId))
      .leftJoin(
        sponsorshipIndividual,
        eq(sponsorshipIndividual.id, sponsorshipFund.sponsorIndividualId),
      )
      .leftJoin(
        sponsorshipOrganization,
        eq(sponsorshipOrganization.id, sponsorshipFund.sponsorOrganizationId),
      )
      .leftJoin(sponsorshipVisitor, eq(sponsorshipVisitor.id, sponsorshipFund.visitorId))
      .leftJoin(sponsorshipFundAllocation, eq(sponsorshipFundAllocation.fundId, sponsorshipFund.id))
      .where(and(...conditions))
      .groupBy(sponsorshipFund.id)
      .orderBy(desc(sponsorshipFund.receivedOn), sponsorshipFund.id);
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
    rows = await runtime.ORM.select({
      visitedOn: sponsorshipVisitor.visitedOn,
      visitorName: sponsorshipVisitor.displayName,
      visitorType: sponsorshipVisitorType.name,
      countryName: sponsorshipVisitor.countryName,
      relatedPersonName: sponsorshipVisitor.relatedPersonName,
      giftsPresented: sponsorshipVisitor.giftsPresented,
      visitSummary: sponsorshipVisitor.visitSummary,
    })
      .from(sponsorshipVisitor)
      .leftJoin(
        sponsorshipVisitorType,
        eq(sponsorshipVisitorType.id, sponsorshipVisitor.visitorTypeId),
      )
      .where(eq(sponsorshipVisitor.organizationId, context.organizationId))
      .orderBy(
        desc(sponsorshipVisitor.visitedOn),
        sql`${sponsorshipVisitor.displayName} collate nocase`,
      );
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
  const [
    individualSummaryRows,
    organizationSummaryRows,
    assignmentSummaryRows,
    fundSummaryRows,
    letterSummaryRows,
    visitorSummaryRows,
  ] = await runtime.ORM.batch([
    runtime.ORM.select({ count: count() })
      .from(sponsorshipIndividual)
      .where(eq(sponsorshipIndividual.organizationId, context.organizationId)),
    runtime.ORM.select({ count: count() })
      .from(sponsorshipOrganization)
      .where(eq(sponsorshipOrganization.organizationId, context.organizationId)),
    runtime.ORM.select({ count: count() })
      .from(sponsorshipAssignment)
      .where(eq(sponsorshipAssignment.organizationId, context.organizationId)),
    runtime.ORM.select({
      count: count(),
      amount: sql<number>`coalesce(sum(${sponsorshipFund.amount}), 0)`,
    })
      .from(sponsorshipFund)
      .where(eq(sponsorshipFund.organizationId, context.organizationId)),
    runtime.ORM.select({ count: count() })
      .from(sponsorshipLetter)
      .where(eq(sponsorshipLetter.organizationId, context.organizationId)),
    runtime.ORM.select({ count: count() })
      .from(sponsorshipVisitor)
      .where(eq(sponsorshipVisitor.organizationId, context.organizationId)),
  ]);
  const individualSummary = individualSummaryRows[0];
  const organizationSummary = organizationSummaryRows[0];
  const assignmentSummary = assignmentSummaryRows[0];
  const fundSummary = fundSummaryRows[0];
  const letterSummary = letterSummaryRows[0];
  const visitorSummary = visitorSummaryRows[0];
  const summaries = {
    individuals: individualSummary?.count ?? 0,
    organizations: organizationSummary?.count ?? 0,
    assignments: assignmentSummary?.count ?? 0,
    funds: fundSummary?.count ?? 0,
    receivedAmount: fundSummary?.amount ?? 0,
    letters: letterSummary?.count ?? 0,
    visitors: visitorSummary?.count ?? 0,
  };
  let totalCount = 0;
  let rows: Record<string, unknown>[] = [];
  if (section === "sponsors") {
    const conditions = [eq(sponsorshipIndividual.organizationId, context.organizationId)];
    if (q)
      conditions.push(
        or(
          sql`lower(${sponsorshipIndividual.displayName}) like ${search} escape '\\'`,
          sql`lower(coalesce(${sponsorshipIndividual.email}, '')) like ${search} escape '\\'`,
          sql`lower(coalesce(${sponsorshipOrganization.name}, '')) like ${search} escape '\\'`,
        )!,
      );
    const where = and(...conditions);
    const assignmentCounts = runtime.ORM.select({
      sponsorId: sponsorshipAssignment.sponsorIndividualId,
      count: count().as("assignment_count"),
    })
      .from(sponsorshipAssignment)
      .groupBy(sponsorshipAssignment.sponsorIndividualId)
      .as("sponsor_assignment_counts");
    const [totalRows, result] = await Promise.all([
      runtime.ORM.select({ total: count() })
        .from(sponsorshipIndividual)
        .leftJoin(
          sponsorshipOrganization,
          eq(sponsorshipOrganization.id, sponsorshipIndividual.sponsorOrganizationId),
        )
        .where(where),
      runtime.ORM.select({
        id: sponsorshipIndividual.id,
        displayName: sponsorshipIndividual.displayName,
        firstName: sponsorshipIndividual.firstName,
        middleName: sponsorshipIndividual.middleName,
        lastName: sponsorshipIndividual.lastName,
        address: sponsorshipIndividual.address,
        countryName: sponsorshipIndividual.countryName,
        email: sponsorshipIndividual.email,
        phone: sponsorshipIndividual.phone,
        sponsorOrganizationId: sponsorshipIndividual.sponsorOrganizationId,
        sponsorTypeId: sponsorshipIndividual.sponsorTypeId,
        sponsorCategoryId: sponsorshipIndividual.sponsorCategoryId,
        organizationName: sponsorshipOrganization.name,
        sponsorType: sponsorshipSponsorType.name,
        sponsorCategory: sponsorshipSponsorCategory.name,
        assignmentCount: sql<number>`coalesce(${assignmentCounts.count}, 0)`,
      })
        .from(sponsorshipIndividual)
        .leftJoin(
          sponsorshipOrganization,
          eq(sponsorshipOrganization.id, sponsorshipIndividual.sponsorOrganizationId),
        )
        .leftJoin(
          sponsorshipSponsorType,
          eq(sponsorshipSponsorType.id, sponsorshipIndividual.sponsorTypeId),
        )
        .leftJoin(
          sponsorshipSponsorCategory,
          eq(sponsorshipSponsorCategory.id, sponsorshipIndividual.sponsorCategoryId),
        )
        .leftJoin(assignmentCounts, eq(assignmentCounts.sponsorId, sponsorshipIndividual.id))
        .where(where)
        .orderBy(sql`${sponsorshipIndividual.displayName} collate nocase`)
        .limit(pageSize)
        .offset(offset),
    ]);
    totalCount = Number(totalRows[0]?.total ?? 0);
    rows = result;
  } else if (section === "assignments") {
    const conditions = [eq(sponsorshipAssignment.organizationId, context.organizationId)];
    if (q)
      conditions.push(
        or(
          sql`lower(${person.displayName}) like ${search} escape '\\'`,
          sql`lower(${sponsorshipIndividual.displayName}) like ${search} escape '\\'`,
          sql`lower(${sponsorshipStatus.name}) like ${search} escape '\\'`,
        )!,
      );
    const where = and(...conditions);
    const [totalRows, result] = await Promise.all([
      runtime.ORM.select({ total: count() })
        .from(sponsorshipAssignment)
        .innerJoin(person, eq(person.id, sponsorshipAssignment.personId))
        .innerJoin(
          sponsorshipIndividual,
          eq(sponsorshipIndividual.id, sponsorshipAssignment.sponsorIndividualId),
        )
        .innerJoin(
          sponsorshipStatus,
          eq(sponsorshipStatus.id, sponsorshipAssignment.sponsorshipStatusId),
        )
        .where(where),
      runtime.ORM.select({
        id: sponsorshipAssignment.id,
        personId: sponsorshipAssignment.personId,
        sponsorIndividualId: sponsorshipAssignment.sponsorIndividualId,
        statusId: sponsorshipAssignment.sponsorshipStatusId,
        sessionId: sponsorshipAssignment.academicSessionId,
        statusOn: sponsorshipAssignment.statusOn,
        remarks: sponsorshipAssignment.remarks,
        personName: person.displayName,
        admissionNumber: person.primaryIdentifier,
        sponsorName: sponsorshipIndividual.displayName,
        statusName: sponsorshipStatus.name,
        sessionName: academicSession.name,
      })
        .from(sponsorshipAssignment)
        .innerJoin(person, eq(person.id, sponsorshipAssignment.personId))
        .innerJoin(
          sponsorshipIndividual,
          eq(sponsorshipIndividual.id, sponsorshipAssignment.sponsorIndividualId),
        )
        .innerJoin(
          sponsorshipStatus,
          eq(sponsorshipStatus.id, sponsorshipAssignment.sponsorshipStatusId),
        )
        .leftJoin(academicSession, eq(academicSession.id, sponsorshipAssignment.academicSessionId))
        .where(where)
        .orderBy(desc(sponsorshipAssignment.statusOn), sql`${person.displayName} collate nocase`)
        .limit(pageSize)
        .offset(offset),
    ]);
    totalCount = Number(totalRows[0]?.total ?? 0);
    rows = result;
  } else if (section === "funds") {
    const sponsorName = sql<
      string | null
    >`coalesce(${sponsorshipIndividual.displayName}, ${sponsorshipOrganization.name}, ${sponsorshipVisitor.displayName})`;
    const conditions = [eq(sponsorshipFund.organizationId, context.organizationId)];
    if (q)
      conditions.push(
        or(
          sql`lower(${sponsorName}) like ${search} escape '\\'`,
          sql`lower(coalesce(${sponsorshipFund.receiptNumber}, '')) like ${search} escape '\\'`,
          sql`lower(${sponsorshipFundType.name}) like ${search} escape '\\'`,
        )!,
      );
    const where = and(...conditions);
    const allocationCounts = runtime.ORM.select({
      fundId: sponsorshipFundAllocation.fundId,
      count: count().as("allocation_count"),
    })
      .from(sponsorshipFundAllocation)
      .groupBy(sponsorshipFundAllocation.fundId)
      .as("fund_allocation_counts");
    const [totalRows, result] = await Promise.all([
      runtime.ORM.select({ total: count() })
        .from(sponsorshipFund)
        .innerJoin(sponsorshipFundType, eq(sponsorshipFundType.id, sponsorshipFund.fundTypeId))
        .leftJoin(
          sponsorshipIndividual,
          eq(sponsorshipIndividual.id, sponsorshipFund.sponsorIndividualId),
        )
        .leftJoin(
          sponsorshipOrganization,
          eq(sponsorshipOrganization.id, sponsorshipFund.sponsorOrganizationId),
        )
        .leftJoin(sponsorshipVisitor, eq(sponsorshipVisitor.id, sponsorshipFund.visitorId))
        .where(where),
      runtime.ORM.select({
        id: sponsorshipFund.id,
        fundTypeId: sponsorshipFund.fundTypeId,
        sessionId: sponsorshipFund.academicSessionId,
        sponsorKind: sponsorshipFund.sponsorKind,
        sponsorPartyId: sql<
          string | null
        >`coalesce(${sponsorshipFund.sponsorIndividualId}, ${sponsorshipFund.sponsorOrganizationId}, ${sponsorshipFund.visitorId})`,
        receivedOn: sponsorshipFund.receivedOn,
        periodFrom: sponsorshipFund.periodFrom,
        periodTo: sponsorshipFund.periodTo,
        amount: sponsorshipFund.amount,
        receiptNumber: sponsorshipFund.receiptNumber,
        remarks: sponsorshipFund.remarks,
        fundType: sponsorshipFundType.name,
        sponsorName: sql<string>`coalesce(${sponsorName}, 'Legacy sponsor')`,
        allocationCount: sql<number>`coalesce(${allocationCounts.count}, 0)`,
      })
        .from(sponsorshipFund)
        .innerJoin(sponsorshipFundType, eq(sponsorshipFundType.id, sponsorshipFund.fundTypeId))
        .leftJoin(
          sponsorshipIndividual,
          eq(sponsorshipIndividual.id, sponsorshipFund.sponsorIndividualId),
        )
        .leftJoin(
          sponsorshipOrganization,
          eq(sponsorshipOrganization.id, sponsorshipFund.sponsorOrganizationId),
        )
        .leftJoin(sponsorshipVisitor, eq(sponsorshipVisitor.id, sponsorshipFund.visitorId))
        .leftJoin(allocationCounts, eq(allocationCounts.fundId, sponsorshipFund.id))
        .where(where)
        .orderBy(desc(sponsorshipFund.receivedOn))
        .limit(pageSize)
        .offset(offset),
    ]);
    totalCount = Number(totalRows[0]?.total ?? 0);
    rows = result;
  } else if (section === "correspondence") {
    const conditions = [eq(sponsorshipLetter.organizationId, context.organizationId)];
    if (q)
      conditions.push(
        or(
          sql`lower(coalesce(${sponsorshipLetter.sender}, '')) like ${search} escape '\\'`,
          sql`lower(coalesce(${sponsorshipLetter.receiver}, '')) like ${search} escape '\\'`,
          sql`lower(${sponsorshipCorrespondenceType.name}) like ${search} escape '\\'`,
        )!,
      );
    const where = and(...conditions);
    const [totalRows, result] = await Promise.all([
      runtime.ORM.select({ total: count() })
        .from(sponsorshipLetter)
        .innerJoin(
          sponsorshipCorrespondenceType,
          eq(sponsorshipCorrespondenceType.id, sponsorshipLetter.correspondenceTypeId),
        )
        .where(where),
      runtime.ORM.select({
        id: sponsorshipLetter.id,
        correspondenceTypeId: sponsorshipLetter.correspondenceTypeId,
        sponsorIndividualId: sponsorshipLetter.sponsorIndividualId,
        personId: sponsorshipLetter.personId,
        sessionId: sponsorshipLetter.academicSessionId,
        sender: sponsorshipLetter.sender,
        receiver: sponsorshipLetter.receiver,
        receivedOn: sponsorshipLetter.receivedOn,
        repliedOn: sponsorshipLetter.repliedOn,
        replyDueOn: sponsorshipLetter.replyDueOn,
        remarks: sponsorshipLetter.remarks,
        correspondenceType: sponsorshipCorrespondenceType.name,
        sponsorName: sponsorshipIndividual.displayName,
        personName: person.displayName,
        admissionNumber: person.primaryIdentifier,
      })
        .from(sponsorshipLetter)
        .innerJoin(
          sponsorshipCorrespondenceType,
          eq(sponsorshipCorrespondenceType.id, sponsorshipLetter.correspondenceTypeId),
        )
        .leftJoin(
          sponsorshipIndividual,
          eq(sponsorshipIndividual.id, sponsorshipLetter.sponsorIndividualId),
        )
        .leftJoin(person, eq(person.id, sponsorshipLetter.personId))
        .where(where)
        .orderBy(desc(sponsorshipLetter.receivedOn))
        .limit(pageSize)
        .offset(offset),
    ]);
    totalCount = Number(totalRows[0]?.total ?? 0);
    rows = result;
  } else {
    const conditions = [eq(sponsorshipVisitor.organizationId, context.organizationId)];
    if (q)
      conditions.push(
        or(
          sql`lower(${sponsorshipVisitor.displayName}) like ${search} escape '\\'`,
          sql`lower(coalesce(${sponsorshipVisitor.countryName}, '')) like ${search} escape '\\'`,
          sql`lower(coalesce(${sponsorshipVisitorType.name}, '')) like ${search} escape '\\'`,
        )!,
      );
    const where = and(...conditions);
    const [totalRows, result] = await Promise.all([
      runtime.ORM.select({ total: count() })
        .from(sponsorshipVisitor)
        .leftJoin(
          sponsorshipVisitorType,
          eq(sponsorshipVisitorType.id, sponsorshipVisitor.visitorTypeId),
        )
        .where(where),
      runtime.ORM.select({
        id: sponsorshipVisitor.id,
        visitorTypeId: sponsorshipVisitor.visitorTypeId,
        firstName: sponsorshipVisitor.firstName,
        middleName: sponsorshipVisitor.middleName,
        lastName: sponsorshipVisitor.lastName,
        displayName: sponsorshipVisitor.displayName,
        address: sponsorshipVisitor.address,
        countryName: sponsorshipVisitor.countryName,
        email: sponsorshipVisitor.email,
        phone: sponsorshipVisitor.phone,
        relatedPersonName: sponsorshipVisitor.relatedPersonName,
        visitedOn: sponsorshipVisitor.visitedOn,
        mementoQuantity: sponsorshipVisitor.mementoQuantity,
        giftsPresented: sponsorshipVisitor.giftsPresented,
        visitSummary: sponsorshipVisitor.visitSummary,
        comments: sponsorshipVisitor.comments,
        visitorType: sponsorshipVisitorType.name,
      })
        .from(sponsorshipVisitor)
        .leftJoin(
          sponsorshipVisitorType,
          eq(sponsorshipVisitorType.id, sponsorshipVisitor.visitorTypeId),
        )
        .where(where)
        .orderBy(desc(sponsorshipVisitor.visitedOn))
        .limit(pageSize)
        .offset(offset),
    ]);
    totalCount = Number(totalRows[0]?.total ?? 0);
    rows = result;
  }
  if (section === "funds") {
    const fundIds = rows.map((row) => String(row.id));
    const allocations = fundIds.length
      ? await runtime.ORM.select({
          fundId: sponsorshipFundAllocation.fundId,
          personId: sponsorshipFundAllocation.personId,
          personName: person.displayName,
          amount: sponsorshipFundAllocation.amount,
          remarks: sponsorshipFundAllocation.remarks,
        })
          .from(sponsorshipFundAllocation)
          .leftJoin(person, eq(person.id, sponsorshipFundAllocation.personId))
          .where(
            and(
              eq(sponsorshipFundAllocation.organizationId, context.organizationId),
              inArray(sponsorshipFundAllocation.fundId, fundIds),
            ),
          )
          .orderBy(sql`${person.displayName} collate nocase`)
      : [];
    const allocationsByFund = new Map<string, Array<Record<string, unknown>>>();
    for (const { fundId, ...allocation } of allocations) {
      const values = allocationsByFund.get(fundId) ?? [];
      values.push(allocation);
      allocationsByFund.set(fundId, values);
    }
    rows = rows.map((row) => ({
      ...row,
      allocations: allocationsByFund.get(String(row.id)) ?? [],
    }));
  }
  return Response.json({
    summary: summaries,
    records: rows,
    pagination: {
      page,
      pageSize,
      total: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
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
  const personSearch = q
    ? or(
        sql`lower(${person.displayName}) LIKE ${search} ESCAPE '\\'`,
        sql`lower(coalesce(${person.primaryIdentifier}, '')) LIKE ${search} ESCAPE '\\'`,
      )
    : undefined;
  const individualSearch = q
    ? sql`lower(${sponsorshipIndividual.displayName}) LIKE ${search} ESCAPE '\\'`
    : undefined;
  const visitorSearch = q
    ? sql`lower(${sponsorshipVisitor.displayName}) LIKE ${search} ESCAPE '\\'`
    : undefined;
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
    runtime.ORM.select({
      id: sponsorshipOrganization.id,
      name: sponsorshipOrganization.name,
      countryName: sponsorshipOrganization.countryName,
      supportsChildren: sponsorshipOrganization.supportsChildren,
      supportsElderly: sponsorshipOrganization.supportsElderly,
    })
      .from(sponsorshipOrganization)
      .where(
        and(
          eq(sponsorshipOrganization.organizationId, context.organizationId),
          eq(sponsorshipOrganization.isActive, 1),
        ),
      )
      .orderBy(asc(sql`lower(${sponsorshipOrganization.name})`)),
    runtime.ORM.select({ id: sponsorshipSponsorType.id, name: sponsorshipSponsorType.name })
      .from(sponsorshipSponsorType)
      .where(
        and(
          eq(sponsorshipSponsorType.organizationId, context.organizationId),
          eq(sponsorshipSponsorType.isActive, 1),
        ),
      )
      .orderBy(asc(sql`lower(${sponsorshipSponsorType.name})`)),
    runtime.ORM.select({ id: sponsorshipSponsorCategory.id, name: sponsorshipSponsorCategory.name })
      .from(sponsorshipSponsorCategory)
      .where(
        and(
          eq(sponsorshipSponsorCategory.organizationId, context.organizationId),
          eq(sponsorshipSponsorCategory.isActive, 1),
        ),
      )
      .orderBy(asc(sql`lower(${sponsorshipSponsorCategory.name})`)),
    runtime.ORM.select({ id: sponsorshipStatus.id, name: sponsorshipStatus.name })
      .from(sponsorshipStatus)
      .where(
        and(
          eq(sponsorshipStatus.organizationId, context.organizationId),
          eq(sponsorshipStatus.isActive, 1),
        ),
      )
      .orderBy(asc(sql`lower(${sponsorshipStatus.name})`)),
    runtime.ORM.select({ id: sponsorshipFundType.id, name: sponsorshipFundType.name })
      .from(sponsorshipFundType)
      .where(
        and(
          eq(sponsorshipFundType.organizationId, context.organizationId),
          eq(sponsorshipFundType.isActive, 1),
        ),
      )
      .orderBy(asc(sql`lower(${sponsorshipFundType.name})`)),
    runtime.ORM.select({
      id: sponsorshipCorrespondenceType.id,
      name: sponsorshipCorrespondenceType.name,
    })
      .from(sponsorshipCorrespondenceType)
      .where(
        and(
          eq(sponsorshipCorrespondenceType.organizationId, context.organizationId),
          eq(sponsorshipCorrespondenceType.isActive, 1),
        ),
      )
      .orderBy(asc(sql`lower(${sponsorshipCorrespondenceType.name})`)),
    runtime.ORM.select({ id: sponsorshipVisitorType.id, name: sponsorshipVisitorType.name })
      .from(sponsorshipVisitorType)
      .where(
        and(
          eq(sponsorshipVisitorType.organizationId, context.organizationId),
          eq(sponsorshipVisitorType.isActive, 1),
        ),
      )
      .orderBy(asc(sql`lower(${sponsorshipVisitorType.name})`)),
    runtime.ORM.select({ id: academicSession.id, name: academicSession.name })
      .from(academicSession)
      .where(eq(academicSession.organizationId, context.organizationId))
      .orderBy(desc(academicSession.startsOn)),
    runtime.ORM.select({
      id: person.id,
      name: person.displayName,
      admissionNumber: person.primaryIdentifier,
    })
      .from(person)
      .where(and(eq(person.organizationId, context.organizationId), personSearch))
      .orderBy(asc(sql`lower(${person.displayName})`))
      .limit(50),
    runtime.ORM.select({ id: sponsorshipIndividual.id, name: sponsorshipIndividual.displayName })
      .from(sponsorshipIndividual)
      .where(
        and(eq(sponsorshipIndividual.organizationId, context.organizationId), individualSearch),
      )
      .orderBy(asc(sql`lower(${sponsorshipIndividual.displayName})`))
      .limit(50),
    runtime.ORM.select({ id: sponsorshipVisitor.id, name: sponsorshipVisitor.displayName })
      .from(sponsorshipVisitor)
      .where(and(eq(sponsorshipVisitor.organizationId, context.organizationId), visitorSearch))
      .orderBy(asc(sql`lower(${sponsorshipVisitor.displayName})`))
      .limit(50),
  ]);
  return Response.json({
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
  if (
    value.kind === "sponsorType" ||
    value.kind === "sponsorCategory" ||
    value.kind === "status" ||
    value.kind === "fundType" ||
    value.kind === "correspondenceType" ||
    value.kind === "visitorType"
  ) {
    const result = await writeSponsorshipCatalog(runtime.ORM, context, value, id);
    if (!result.found) return Response.json({ error: "Setup record not found." }, { status: 404 });
    return Response.json({ id }, { status: result.existing ? 200 : 201 });
  }
  if (value.kind === "organization") {
    const existing = value.id
      ? Boolean(
          (
            await runtime.ORM.select({ id: sponsorshipOrganization.id })
              .from(sponsorshipOrganization)
              .where(
                and(
                  eq(sponsorshipOrganization.id, value.id),
                  eq(sponsorshipOrganization.organizationId, context.organizationId),
                ),
              )
              .limit(1)
          )[0],
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Sponsor organization not found." }, { status: 404 });
    const values = {
      name: value.name,
      countryName: value.countryName ?? null,
      supportsChildren: value.supportsChildren ? 1 : 0,
      supportsElderly: value.supportsElderly ? 1 : 0,
    };
    const statement = existing
      ? runtime.ORM.update(sponsorshipOrganization)
          .set({ ...values, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(
            and(
              eq(sponsorshipOrganization.id, id),
              eq(sponsorshipOrganization.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(sponsorshipOrganization).values({
          id,
          organizationId: context.organizationId,
          ...values,
          sourceSystem: "tsewa",
          sourceTable: "sponsorship_organization",
          sourceId: id,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
        context,
        `sponsorship.organization_${existing ? "updated" : "created"}`,
        "sponsorship_organization",
        id,
      ),
    ]);
    return Response.json({ id }, { status: existing ? 200 : 201 });
  }
  if (value.kind === "individual") {
    const referenceChecks = await Promise.all([
      value.sponsorOrganizationId
        ? runtime.ORM.select({ id: sponsorshipOrganization.id })
            .from(sponsorshipOrganization)
            .where(
              and(
                eq(sponsorshipOrganization.id, value.sponsorOrganizationId),
                eq(sponsorshipOrganization.organizationId, context.organizationId),
              ),
            )
            .limit(1)
        : Promise.resolve([{ id: "optional" }]),
      value.sponsorTypeId
        ? runtime.ORM.select({ id: sponsorshipSponsorType.id })
            .from(sponsorshipSponsorType)
            .where(
              and(
                eq(sponsorshipSponsorType.id, value.sponsorTypeId),
                eq(sponsorshipSponsorType.organizationId, context.organizationId),
              ),
            )
            .limit(1)
        : Promise.resolve([{ id: "optional" }]),
      value.sponsorCategoryId
        ? runtime.ORM.select({ id: sponsorshipSponsorCategory.id })
            .from(sponsorshipSponsorCategory)
            .where(
              and(
                eq(sponsorshipSponsorCategory.id, value.sponsorCategoryId),
                eq(sponsorshipSponsorCategory.organizationId, context.organizationId),
              ),
            )
            .limit(1)
        : Promise.resolve([{ id: "optional" }]),
    ]);
    if (referenceChecks.some((rows) => rows.length === 0))
      return Response.json({ error: "Choose valid sponsor setup values." }, { status: 400 });
    const existing = value.id
      ? Boolean(
          (
            await runtime.ORM.select({ id: sponsorshipIndividual.id })
              .from(sponsorshipIndividual)
              .where(
                and(
                  eq(sponsorshipIndividual.id, value.id),
                  eq(sponsorshipIndividual.organizationId, context.organizationId),
                ),
              )
              .limit(1)
          )[0],
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Individual sponsor not found." }, { status: 404 });
    const displayName = sponsorshipDisplayName([value.firstName, value.middleName, value.lastName]);
    const values = {
      sponsorOrganizationId: value.sponsorOrganizationId ?? null,
      sponsorTypeId: value.sponsorTypeId ?? null,
      sponsorCategoryId: value.sponsorCategoryId ?? null,
      firstName: value.firstName,
      middleName: value.middleName ?? null,
      lastName: value.lastName ?? null,
      displayName,
      address: value.address ?? null,
      countryName: value.countryName ?? null,
      email: value.email ?? null,
      phone: value.phone ?? null,
    };
    const statement = existing
      ? runtime.ORM.update(sponsorshipIndividual)
          .set({ ...values, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(
            and(
              eq(sponsorshipIndividual.id, id),
              eq(sponsorshipIndividual.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(sponsorshipIndividual).values({
          id,
          organizationId: context.organizationId,
          ...values,
          sourceSystem: "tsewa",
          sourceTable: "sponsorship_individual",
          sourceId: id,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
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
        runtime.ORM,
        "person",
        value.personId,
        context.organizationId,
      )) ||
      !(await sponsorshipEntityExists(
        runtime.ORM,
        "sponsorship_individual",
        value.sponsorIndividualId,
        context.organizationId,
      )) ||
      !(await sponsorshipEntityExists(
        runtime.ORM,
        "sponsorship_status",
        value.statusId,
        context.organizationId,
      )) ||
      (value.sessionId &&
        !(await scholarshipSessionExists(runtime.ORM, context.organizationId, value.sessionId)))
    )
      return Response.json(
        { error: "Choose a valid person, sponsor, status, and session." },
        { status: 400 },
      );
    const existing = value.id
      ? Boolean(
          (
            await runtime.ORM.select({ id: sponsorshipAssignment.id })
              .from(sponsorshipAssignment)
              .where(
                and(
                  eq(sponsorshipAssignment.id, value.id),
                  eq(sponsorshipAssignment.organizationId, context.organizationId),
                ),
              )
              .limit(1)
          )[0],
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Sponsor assignment not found." }, { status: 404 });
    const values = {
      personId: value.personId,
      sponsorIndividualId: value.sponsorIndividualId,
      sponsorshipStatusId: value.statusId,
      academicSessionId: value.sessionId ?? null,
      statusOn: value.statusOn,
      remarks: value.remarks ?? null,
    };
    const statement = existing
      ? runtime.ORM.update(sponsorshipAssignment)
          .set({ ...values, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(
            and(
              eq(sponsorshipAssignment.id, id),
              eq(sponsorshipAssignment.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(sponsorshipAssignment).values({
          id,
          organizationId: context.organizationId,
          ...values,
          sourceSystem: "tsewa",
          sourceTable: "sponsorship_assignment",
          sourceId: id,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
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
        runtime.ORM,
        "sponsorship_visitor_type",
        value.visitorTypeId,
        context.organizationId,
      ))
    )
      return Response.json({ error: "Choose a valid visitor type." }, { status: 400 });
    const existing = value.id
      ? Boolean(
          (
            await runtime.ORM.select({ id: sponsorshipVisitor.id })
              .from(sponsorshipVisitor)
              .where(
                and(
                  eq(sponsorshipVisitor.id, value.id),
                  eq(sponsorshipVisitor.organizationId, context.organizationId),
                ),
              )
              .limit(1)
          )[0],
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Visitor not found." }, { status: 404 });
    const displayName = sponsorshipDisplayName([value.firstName, value.middleName, value.lastName]);
    const values = {
      visitorTypeId: value.visitorTypeId ?? null,
      firstName: value.firstName,
      middleName: value.middleName ?? null,
      lastName: value.lastName ?? null,
      displayName,
      address: value.address ?? null,
      countryName: value.countryName ?? null,
      email: value.email ?? null,
      phone: value.phone ?? null,
      relatedPersonName: value.relatedPersonName ?? null,
      visitedOn: value.visitedOn,
      mementoQuantity: value.mementoQuantity ?? null,
      giftsPresented: value.giftsPresented ?? null,
      visitSummary: value.visitSummary ?? null,
      comments: value.comments ?? null,
    };
    const statement = existing
      ? runtime.ORM.update(sponsorshipVisitor)
          .set({ ...values, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(
            and(
              eq(sponsorshipVisitor.id, id),
              eq(sponsorshipVisitor.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(sponsorshipVisitor).values({
          id,
          organizationId: context.organizationId,
          ...values,
          sourceSystem: "tsewa",
          sourceTable: "sponsorship_visitor",
          sourceId: id,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
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
        runtime.ORM,
        "sponsorship_correspondence_type",
        value.correspondenceTypeId,
        context.organizationId,
      )) ||
      (value.sponsorIndividualId &&
        !(await sponsorshipEntityExists(
          runtime.ORM,
          "sponsorship_individual",
          value.sponsorIndividualId,
          context.organizationId,
        ))) ||
      (value.personId &&
        !(await sponsorshipEntityExists(
          runtime.ORM,
          "person",
          value.personId,
          context.organizationId,
        ))) ||
      (value.sessionId &&
        !(await scholarshipSessionExists(runtime.ORM, context.organizationId, value.sessionId)))
    )
      return Response.json({ error: "Choose valid correspondence references." }, { status: 400 });
    const existing = value.id
      ? Boolean(
          (
            await runtime.ORM.select({ id: sponsorshipLetter.id })
              .from(sponsorshipLetter)
              .where(
                and(
                  eq(sponsorshipLetter.id, value.id),
                  eq(sponsorshipLetter.organizationId, context.organizationId),
                ),
              )
              .limit(1)
          )[0],
        )
      : false;
    if (value.id && !existing)
      return Response.json({ error: "Correspondence not found." }, { status: 404 });
    const values = {
      correspondenceTypeId: value.correspondenceTypeId,
      sponsorIndividualId: value.sponsorIndividualId ?? null,
      personId: value.personId ?? null,
      academicSessionId: value.sessionId ?? null,
      sender: value.sender ?? null,
      receiver: value.receiver ?? null,
      receivedOn: value.receivedOn,
      repliedOn: value.repliedOn ?? null,
      replyDueOn: value.replyDueOn ?? null,
      remarks: value.remarks ?? null,
    };
    const statement = existing
      ? runtime.ORM.update(sponsorshipLetter)
          .set({ ...values, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(
            and(
              eq(sponsorshipLetter.id, id),
              eq(sponsorshipLetter.organizationId, context.organizationId),
            ),
          )
      : runtime.ORM.insert(sponsorshipLetter).values({
          id,
          organizationId: context.organizationId,
          ...values,
          sourceSystem: "tsewa",
          sourceTable: "sponsorship_letter",
          sourceId: id,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
        });
    await runtime.ORM.batch([
      statement,
      auditInsert(
        runtime.ORM,
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
      runtime.ORM,
      "sponsorship_fund_type",
      value.fundTypeId,
      context.organizationId,
    )) ||
    (value.sessionId &&
      !(await scholarshipSessionExists(runtime.ORM, context.organizationId, value.sessionId)))
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
      runtime.ORM,
      partyTable,
      value.sponsorPartyId,
      context.organizationId,
    ))
  )
    return Response.json({ error: "Choose a valid remittance source." }, { status: 400 });
  const people = new Set(
    (
      await runtime.ORM.select({ id: person.id })
        .from(person)
        .where(eq(person.organizationId, context.organizationId))
    ).map((item) => item.id),
  );
  if (value.allocations.some((item) => !people.has(item.personId)))
    return Response.json({ error: "Choose valid allocation beneficiaries." }, { status: 400 });
  if (!allocationsFitFund(value.amount, value.allocations))
    return Response.json(
      { error: "Beneficiary allocations cannot exceed the remittance amount." },
      { status: 400 },
    );
  const existing = value.id
    ? Boolean(
        (
          await runtime.ORM.select({ id: sponsorshipFund.id })
            .from(sponsorshipFund)
            .where(
              and(
                eq(sponsorshipFund.id, value.id),
                eq(sponsorshipFund.organizationId, context.organizationId),
              ),
            )
            .limit(1)
        )[0],
      )
    : false;
  if (value.id && !existing)
    return Response.json({ error: "Remittance not found." }, { status: 404 });
  const individualId = value.sponsorKind === "individual" ? value.sponsorPartyId : null;
  const organizationId = value.sponsorKind === "organization" ? value.sponsorPartyId : null;
  const visitorId = value.sponsorKind === "visitor" ? value.sponsorPartyId : null;
  const values = {
    fundTypeId: value.fundTypeId,
    academicSessionId: value.sessionId ?? null,
    sponsorKind: value.sponsorKind,
    sponsorIndividualId: individualId,
    sponsorOrganizationId: organizationId,
    visitorId,
    receivedOn: value.receivedOn,
    periodFrom: value.periodFrom ?? null,
    periodTo: value.periodTo ?? null,
    amount: value.amount,
    receiptNumber: value.receiptNumber ?? null,
    remarks: value.remarks ?? null,
  };
  const fundStatement = existing
    ? runtime.ORM.update(sponsorshipFund)
        .set({ ...values, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(
            eq(sponsorshipFund.id, id),
            eq(sponsorshipFund.organizationId, context.organizationId),
          ),
        )
    : runtime.ORM.insert(sponsorshipFund).values({
        id,
        organizationId: context.organizationId,
        ...values,
        sourceSystem: "tsewa",
        sourceTable: "sponsorship_fund",
        sourceId: id,
        createdByUserId: context.userId,
        updatedByUserId: context.userId,
      });
  const deleteAllocations = runtime.ORM.delete(sponsorshipFundAllocation).where(
    and(
      eq(sponsorshipFundAllocation.fundId, id),
      eq(sponsorshipFundAllocation.organizationId, context.organizationId),
    ),
  );
  const audit = auditInsert(
    runtime.ORM,
    context,
    `sponsorship.fund_${existing ? "updated" : "created"}`,
    "sponsorship_fund",
    id,
    { allocationCount: String(value.allocations.length) },
  );
  if (value.allocations.length > 0) {
    const insertAllocations = runtime.ORM.insert(sponsorshipFundAllocation).values(
      value.allocations.map((allocation) => {
        const allocationId = crypto.randomUUID();
        return {
          id: allocationId,
          organizationId: context.organizationId,
          fundId: id,
          personId: allocation.personId,
          academicSessionId: value.sessionId ?? null,
          amount: allocation.amount,
          periodFrom: value.periodFrom ?? null,
          periodTo: value.periodTo ?? null,
          remarks: allocation.remarks ?? null,
          sourceSystem: "tsewa",
          sourceTable: "sponsorship_fund_allocation",
          sourceId: allocationId,
          createdByUserId: context.userId,
          updatedByUserId: context.userId,
        };
      }),
    );
    await runtime.ORM.batch([fundStatement, deleteAllocations, insertAllocations, audit]);
  } else {
    await runtime.ORM.batch([fundStatement, deleteAllocations, audit]);
  }
  return Response.json({ id }, { status: existing ? 200 : 201 });
}

type SponsorshipCatalogValue = Extract<
  z.infer<typeof sponsorshipMutationSchema>,
  {
    kind:
      | "sponsorType"
      | "sponsorCategory"
      | "status"
      | "fundType"
      | "correspondenceType"
      | "visitorType";
  }
>;

async function writeSponsorshipCatalog(
  database: Database,
  context: MembershipContext,
  value: SponsorshipCatalogValue,
  id: string,
): Promise<{ found: boolean; existing: boolean }> {
  const source = {
    id,
    organizationId: context.organizationId,
    name: value.name,
    sourceSystem: "tsewa",
    sourceId: id,
    createdByUserId: context.userId,
    updatedByUserId: context.userId,
  };
  if (value.kind === "sponsorType") {
    const existing = Boolean(
      value.id &&
      (
        await database
          .select({ id: sponsorshipSponsorType.id })
          .from(sponsorshipSponsorType)
          .where(
            and(
              eq(sponsorshipSponsorType.id, id),
              eq(sponsorshipSponsorType.organizationId, context.organizationId),
            ),
          )
          .limit(1)
      )[0],
    );
    if (value.id && !existing) return { found: false, existing };
    const statement = existing
      ? database
          .update(sponsorshipSponsorType)
          .set({
            name: value.name,
            updatedByUserId: context.userId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(sponsorshipSponsorType.id, id),
              eq(sponsorshipSponsorType.organizationId, context.organizationId),
            ),
          )
      : database
          .insert(sponsorshipSponsorType)
          .values({ ...source, sourceTable: "sponsorship_sponsor_type" });
    await database.batch([
      statement,
      auditInsert(
        database,
        context,
        `sponsorship.${value.kind}_${existing ? "updated" : "created"}`,
        "sponsorship_sponsor_type",
        id,
      ),
    ]);
    return { found: true, existing };
  }
  if (value.kind === "sponsorCategory") {
    const existing = Boolean(
      value.id &&
      (
        await database
          .select({ id: sponsorshipSponsorCategory.id })
          .from(sponsorshipSponsorCategory)
          .where(
            and(
              eq(sponsorshipSponsorCategory.id, id),
              eq(sponsorshipSponsorCategory.organizationId, context.organizationId),
            ),
          )
          .limit(1)
      )[0],
    );
    if (value.id && !existing) return { found: false, existing };
    const statement = existing
      ? database
          .update(sponsorshipSponsorCategory)
          .set({
            name: value.name,
            updatedByUserId: context.userId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(sponsorshipSponsorCategory.id, id),
              eq(sponsorshipSponsorCategory.organizationId, context.organizationId),
            ),
          )
      : database
          .insert(sponsorshipSponsorCategory)
          .values({ ...source, sourceTable: "sponsorship_sponsor_category" });
    await database.batch([
      statement,
      auditInsert(
        database,
        context,
        `sponsorship.${value.kind}_${existing ? "updated" : "created"}`,
        "sponsorship_sponsor_category",
        id,
      ),
    ]);
    return { found: true, existing };
  }
  if (value.kind === "status") {
    const existing = Boolean(
      value.id &&
      (
        await database
          .select({ id: sponsorshipStatus.id })
          .from(sponsorshipStatus)
          .where(
            and(
              eq(sponsorshipStatus.id, id),
              eq(sponsorshipStatus.organizationId, context.organizationId),
            ),
          )
          .limit(1)
      )[0],
    );
    if (value.id && !existing) return { found: false, existing };
    const statement = existing
      ? database
          .update(sponsorshipStatus)
          .set({
            name: value.name,
            updatedByUserId: context.userId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(sponsorshipStatus.id, id),
              eq(sponsorshipStatus.organizationId, context.organizationId),
            ),
          )
      : database.insert(sponsorshipStatus).values({ ...source, sourceTable: "sponsorship_status" });
    await database.batch([
      statement,
      auditInsert(
        database,
        context,
        `sponsorship.${value.kind}_${existing ? "updated" : "created"}`,
        "sponsorship_status",
        id,
      ),
    ]);
    return { found: true, existing };
  }
  if (value.kind === "fundType") {
    const existing = Boolean(
      value.id &&
      (
        await database
          .select({ id: sponsorshipFundType.id })
          .from(sponsorshipFundType)
          .where(
            and(
              eq(sponsorshipFundType.id, id),
              eq(sponsorshipFundType.organizationId, context.organizationId),
            ),
          )
          .limit(1)
      )[0],
    );
    if (value.id && !existing) return { found: false, existing };
    const statement = existing
      ? database
          .update(sponsorshipFundType)
          .set({
            name: value.name,
            updatedByUserId: context.userId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(sponsorshipFundType.id, id),
              eq(sponsorshipFundType.organizationId, context.organizationId),
            ),
          )
      : database
          .insert(sponsorshipFundType)
          .values({ ...source, sourceTable: "sponsorship_fund_type" });
    await database.batch([
      statement,
      auditInsert(
        database,
        context,
        `sponsorship.${value.kind}_${existing ? "updated" : "created"}`,
        "sponsorship_fund_type",
        id,
      ),
    ]);
    return { found: true, existing };
  }
  if (value.kind === "correspondenceType") {
    const existing = Boolean(
      value.id &&
      (
        await database
          .select({ id: sponsorshipCorrespondenceType.id })
          .from(sponsorshipCorrespondenceType)
          .where(
            and(
              eq(sponsorshipCorrespondenceType.id, id),
              eq(sponsorshipCorrespondenceType.organizationId, context.organizationId),
            ),
          )
          .limit(1)
      )[0],
    );
    if (value.id && !existing) return { found: false, existing };
    const statement = existing
      ? database
          .update(sponsorshipCorrespondenceType)
          .set({
            name: value.name,
            updatedByUserId: context.userId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(sponsorshipCorrespondenceType.id, id),
              eq(sponsorshipCorrespondenceType.organizationId, context.organizationId),
            ),
          )
      : database
          .insert(sponsorshipCorrespondenceType)
          .values({ ...source, sourceTable: "sponsorship_correspondence_type" });
    await database.batch([
      statement,
      auditInsert(
        database,
        context,
        `sponsorship.${value.kind}_${existing ? "updated" : "created"}`,
        "sponsorship_correspondence_type",
        id,
      ),
    ]);
    return { found: true, existing };
  }
  const existing = Boolean(
    value.id &&
    (
      await database
        .select({ id: sponsorshipVisitorType.id })
        .from(sponsorshipVisitorType)
        .where(
          and(
            eq(sponsorshipVisitorType.id, id),
            eq(sponsorshipVisitorType.organizationId, context.organizationId),
          ),
        )
        .limit(1)
    )[0],
  );
  if (value.id && !existing) return { found: false, existing };
  const statement = existing
    ? database
        .update(sponsorshipVisitorType)
        .set({
          name: value.name,
          updatedByUserId: context.userId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(sponsorshipVisitorType.id, id),
            eq(sponsorshipVisitorType.organizationId, context.organizationId),
          ),
        )
    : database
        .insert(sponsorshipVisitorType)
        .values({ ...source, sourceTable: "sponsorship_visitor_type" });
  await database.batch([
    statement,
    auditInsert(
      database,
      context,
      `sponsorship.${value.kind}_${existing ? "updated" : "created"}`,
      "sponsorship_visitor_type",
      id,
    ),
  ]);
  return { found: true, existing };
}

async function sponsorshipEntityExists(
  database: Database,
  table:
    | "person"
    | "sponsorship_organization"
    | "sponsorship_sponsor_type"
    | "sponsorship_sponsor_category"
    | "sponsorship_status"
    | "sponsorship_individual"
    | "sponsorship_fund_type"
    | "sponsorship_visitor_type"
    | "sponsorship_visitor"
    | "sponsorship_correspondence_type",
  id: string,
  organizationId: string,
): Promise<boolean> {
  if (table === "person")
    return (
      (await database.$count(
        person,
        and(eq(person.id, id), eq(person.organizationId, organizationId)),
      )) > 0
    );
  if (table === "sponsorship_organization")
    return (
      (await database.$count(
        sponsorshipOrganization,
        and(
          eq(sponsorshipOrganization.id, id),
          eq(sponsorshipOrganization.organizationId, organizationId),
        ),
      )) > 0
    );
  if (table === "sponsorship_sponsor_type")
    return (
      (await database.$count(
        sponsorshipSponsorType,
        and(
          eq(sponsorshipSponsorType.id, id),
          eq(sponsorshipSponsorType.organizationId, organizationId),
        ),
      )) > 0
    );
  if (table === "sponsorship_sponsor_category")
    return (
      (await database.$count(
        sponsorshipSponsorCategory,
        and(
          eq(sponsorshipSponsorCategory.id, id),
          eq(sponsorshipSponsorCategory.organizationId, organizationId),
        ),
      )) > 0
    );
  if (table === "sponsorship_status")
    return (
      (await database.$count(
        sponsorshipStatus,
        and(eq(sponsorshipStatus.id, id), eq(sponsorshipStatus.organizationId, organizationId)),
      )) > 0
    );
  if (table === "sponsorship_individual")
    return (
      (await database.$count(
        sponsorshipIndividual,
        and(
          eq(sponsorshipIndividual.id, id),
          eq(sponsorshipIndividual.organizationId, organizationId),
        ),
      )) > 0
    );
  if (table === "sponsorship_fund_type")
    return (
      (await database.$count(
        sponsorshipFundType,
        and(eq(sponsorshipFundType.id, id), eq(sponsorshipFundType.organizationId, organizationId)),
      )) > 0
    );
  if (table === "sponsorship_visitor_type")
    return (
      (await database.$count(
        sponsorshipVisitorType,
        and(
          eq(sponsorshipVisitorType.id, id),
          eq(sponsorshipVisitorType.organizationId, organizationId),
        ),
      )) > 0
    );
  if (table === "sponsorship_visitor")
    return (
      (await database.$count(
        sponsorshipVisitor,
        and(eq(sponsorshipVisitor.id, id), eq(sponsorshipVisitor.organizationId, organizationId)),
      )) > 0
    );
  return (
    (await database.$count(
      sponsorshipCorrespondenceType,
      and(
        eq(sponsorshipCorrespondenceType.id, id),
        eq(sponsorshipCorrespondenceType.organizationId, organizationId),
      ),
    )) > 0
  );
}

function scholarshipRecordWrite(
  database: Database,
  mode: "insert" | "update",
  context: MembershipContext,
  id: string,
  value: z.infer<typeof scholarshipRecordSchema>,
) {
  const values = {
    personId: value.personId,
    academicSessionId: value.sessionId ?? null,
    courseId: value.courseId,
    beneficiaryCategory: value.beneficiaryCategory ?? null,
    studentName: value.studentName,
    admissionNumber: value.admissionNumber ?? null,
    fatherName: value.fatherName ?? null,
    gender: value.gender ?? null,
    dateOfBirth: value.dateOfBirth ?? null,
    classStream: value.classStream ?? null,
    classPercentage: value.classPercentage ?? null,
    admissionYear: value.admissionYear ?? null,
    courseDuration: value.courseDuration ?? null,
    collegeTraining: value.collegeTraining ? 1 : 0,
    cityName: value.cityName ?? null,
    permanentAddress: value.permanentAddress ?? null,
    mailingAddress: value.mailingAddress ?? null,
    specialAllowance: value.specialAllowance ? 1 : 0,
    scholarshipAwarded: value.scholarshipAwarded ?? null,
    instituteName: value.instituteName ?? null,
    bankAccountNumber: value.bankAccountNumber ?? null,
    wardHealthRecord: value.wardHealthRecord ?? null,
    needyCase: value.needyCase ?? null,
    reason: value.reason ?? null,
    status: value.status,
    phone: value.phone ?? null,
    ledgerNumber: value.ledgerNumber ?? null,
  };
  return mode === "update"
    ? database
        .update(scholarshipRecord)
        .set({ ...values, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(
            eq(scholarshipRecord.id, id),
            eq(scholarshipRecord.organizationId, context.organizationId),
          ),
        )
    : database.insert(scholarshipRecord).values({
        id,
        organizationId: context.organizationId,
        ...values,
        sourceSystem: "tsewa",
        sourceTable: "scholarship_record",
        sourceId: id,
        createdByUserId: context.userId,
        updatedByUserId: context.userId,
      });
}

async function validScholarshipReferences(
  database: Database,
  organizationId: string,
  value: z.infer<typeof scholarshipRecordSchema>,
) {
  const [personReference, course, session] = await Promise.all([
    database
      .select({ id: person.id })
      .from(person)
      .where(and(eq(person.id, value.personId), eq(person.organizationId, organizationId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    database
      .select({ id: scholarshipCourse.id })
      .from(scholarshipCourse)
      .where(
        and(
          eq(scholarshipCourse.id, value.courseId),
          eq(scholarshipCourse.organizationId, organizationId),
          eq(scholarshipCourse.isActive, 1),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    value.sessionId
      ? scholarshipSessionExists(database, organizationId, value.sessionId)
      : Promise.resolve(true),
  ]);
  return Boolean(personReference && course && session);
}
async function scholarshipSessionExists(
  database: Database,
  organizationId: string,
  sessionId: string,
) {
  return database
    .select({ id: academicSession.id })
    .from(academicSession)
    .where(
      and(eq(academicSession.id, sessionId), eq(academicSession.organizationId, organizationId)),
    )
    .limit(1)
    .then((rows) => Boolean(rows[0]));
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
  const sheet = await runtime.ORM.select({
    id: markSheet.id,
    status: markSheet.status,
    sourceSystem: markSheet.sourceSystem,
    verifiedAt: markSheet.verifiedAt,
    verifiedByUserId: markSheet.verifiedByUserId,
    finalizedAt: markSheet.finalizedAt,
    finalizedByUserId: markSheet.finalizedByUserId,
  })
    .from(markSheet)
    .where(and(eq(markSheet.id, markSheetId), eq(markSheet.organizationId, context.organizationId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!sheet) return Response.json({ error: "Mark sheet not found." }, { status: 404 });
  if (!isTsewaSource(sheet.sourceSystem)) {
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
  await runtime.ORM.batch([
    runtime.ORM.update(markSheet)
      .set({
        status: transition,
        isVerified: verified ? 1 : 0,
        verifiedAt:
          transition === "verified"
            ? sql`CURRENT_TIMESTAMP`
            : transition === "draft"
              ? null
              : sheet.verifiedAt,
        verifiedByUserId:
          transition === "verified"
            ? context.userId
            : transition === "draft"
              ? null
              : sheet.verifiedByUserId,
        finalizedAt:
          transition === "final"
            ? sql`CURRENT_TIMESTAMP`
            : transition === "draft"
              ? null
              : sheet.finalizedAt,
        finalizedByUserId:
          transition === "final"
            ? context.userId
            : transition === "draft"
              ? null
              : sheet.finalizedByUserId,
        updatedByUserId: context.userId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(eq(markSheet.id, markSheetId), eq(markSheet.organizationId, context.organizationId)),
      ),
    auditInsert(
      runtime.ORM,
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
  const runtime = getRuntimeEnv();
  const conditions = [eq(healthVisit.organizationId, context.organizationId)];
  if (kind !== "all") conditions.push(eq(healthVisit.patientKind, kind));
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    const searchDiagnosis = alias(healthDiagnosis, "search_diagnosis");
    conditions.push(
      or(
        sql`lower(${healthVisit.patientName}) like ${search} escape '\\'`,
        sql`lower(coalesce(${healthVisit.admissionNumber}, '')) like ${search} escape '\\'`,
        exists(
          runtime.ORM.select({ value: sql`1` })
            .from(searchDiagnosis)
            .where(
              and(
                eq(searchDiagnosis.healthVisitId, healthVisit.id),
                sql`lower(${searchDiagnosis.diagnosisName}) like ${search} escape '\\'`,
              ),
            ),
        ),
      )!,
    );
  }
  const where = and(...conditions);
  const [summaryRows, diagnosisSummaryRows, countRows, visits] = await runtime.ORM.batch([
    runtime.ORM.select({
      visits: count(),
      linkedPeople: sql<number>`count(distinct ${healthVisit.personId})`,
      firstVisitOn: sql<string | null>`min(${healthVisit.checkupDate})`,
      lastVisitOn: sql<string | null>`max(${healthVisit.checkupDate})`,
    })
      .from(healthVisit)
      .where(eq(healthVisit.organizationId, context.organizationId)),
    runtime.ORM.select({ diagnoses: count() })
      .from(healthDiagnosis)
      .where(eq(healthDiagnosis.organizationId, context.organizationId)),
    runtime.ORM.select({ total: count() }).from(healthVisit).where(where),
    runtime.ORM.select({
      id: healthVisit.id,
      personId: healthVisit.personId,
      patientName: healthVisit.patientName,
      patientKind: healthVisit.patientKind,
      admissionNumber: healthVisit.admissionNumber,
      gender: healthVisit.gender,
      homeName: healthVisit.homeName,
      ageAtVisit: healthVisit.ageAtVisit,
      checkupDate: healthVisit.checkupDate,
      admittedOn: healthVisit.admittedOn,
      dischargedOn: healthVisit.dischargedOn,
      doctorName: healthVisit.doctorName,
      referredTo: healthVisit.referredTo,
      referralLocation: healthVisit.referralLocation,
      remarks: healthVisit.remarks,
      hepatitisBStatus: healthVisit.hepatitisBStatus,
    })
      .from(healthVisit)
      .where(where)
      .orderBy(desc(healthVisit.checkupDate), sql`${healthVisit.patientName} collate nocase`)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const summary = summaryRows[0];
  const diagnosisSummary = diagnosisSummaryRows[0];
  const countRow = countRows[0];
  const visitIds = visits.map((visit) => visit.id);
  const diagnoses = visitIds.length
    ? await runtime.ORM.select({
        visitId: healthDiagnosis.healthVisitId,
        id: healthDiagnosis.id,
        name: healthDiagnosis.diagnosisName,
        recordedOn: healthDiagnosis.recordedOn,
        remarks: healthDiagnosis.remarks,
      })
        .from(healthDiagnosis)
        .where(
          and(
            eq(healthDiagnosis.organizationId, context.organizationId),
            inArray(healthDiagnosis.healthVisitId, visitIds),
          ),
        )
    : [];
  const diagnosesByVisit = new Map<string, Array<Omit<(typeof diagnoses)[number], "visitId">>>();
  for (const { visitId, ...diagnosis } of diagnoses) {
    const values = diagnosesByVisit.get(visitId) ?? [];
    values.push(diagnosis);
    diagnosesByVisit.set(visitId, values);
  }
  const total = Number(countRow?.total ?? 0);
  return Response.json({
    summary: {
      visits: Number(summary?.visits ?? 0),
      diagnoses: Number(diagnosisSummary?.diagnoses ?? 0),
      linkedPeople: Number(summary?.linkedPeople ?? 0),
      firstVisitOn: summary?.firstVisitOn ?? null,
      lastVisitOn: summary?.lastVisitOn ?? null,
    },
    visits: visits.map((visit) => ({
      ...visit,
      diagnoses: diagnosesByVisit.get(visit.id) ?? [],
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
  const runtime = getRuntimeEnv();
  const conditions = [eq(healthTbCase.organizationId, context.organizationId)];
  if (kind !== "all") conditions.push(eq(healthTbCase.patientKind, kind));
  if (outcome !== "all") conditions.push(eq(healthTbCase.outcome, outcome));
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    const searchDetail = alias(healthTbDetail, "search_tb_detail");
    conditions.push(
      or(
        sql`lower(${healthTbCase.patientName}) like ${search} escape '\\'`,
        sql`lower(coalesce(${healthTbCase.admissionNumber}, '')) like ${search} escape '\\'`,
        sql`lower(coalesce(${healthTbCase.tbCardNumber}, '')) like ${search} escape '\\'`,
        exists(
          runtime.ORM.select({ value: sql`1` })
            .from(searchDetail)
            .where(
              and(
                eq(searchDetail.tbCaseId, healthTbCase.id),
                or(
                  sql`lower(${searchDetail.testName}) like ${search} escape '\\'`,
                  sql`lower(coalesce(${searchDetail.result}, '')) like ${search} escape '\\'`,
                ),
              ),
            ),
        ),
      )!,
    );
  }
  const where = and(...conditions);
  const [summaryRows, detailSummaryRows, outcomes, countRows, cases] = await runtime.ORM.batch([
    runtime.ORM.select({
      cases: count(),
      linkedPeople: sql<number>`count(distinct ${healthTbCase.personId})`,
      firstRegistrationOn: sql<string | null>`min(${healthTbCase.registrationDate})`,
      lastRegistrationOn: sql<string | null>`max(${healthTbCase.registrationDate})`,
      onTreatment: sql<number>`sum(case when lower(${healthTbCase.outcome}) = 'on treatment' then 1 else 0 end)`,
    })
      .from(healthTbCase)
      .where(eq(healthTbCase.organizationId, context.organizationId)),
    runtime.ORM.select({ details: count() })
      .from(healthTbDetail)
      .where(eq(healthTbDetail.organizationId, context.organizationId)),
    runtime.ORM.select({ outcome: healthTbCase.outcome, count: count() })
      .from(healthTbCase)
      .where(eq(healthTbCase.organizationId, context.organizationId))
      .groupBy(healthTbCase.outcome)
      .orderBy(desc(count()), sql`${healthTbCase.outcome} collate nocase`),
    runtime.ORM.select({ total: count() }).from(healthTbCase).where(where),
    runtime.ORM.select({
      id: healthTbCase.id,
      personId: healthTbCase.personId,
      patientName: healthTbCase.patientName,
      patientKind: healthTbCase.patientKind,
      tbCardNumber: healthTbCase.tbCardNumber,
      admissionNumber: healthTbCase.admissionNumber,
      fatherName: healthTbCase.fatherName,
      gender: healthTbCase.gender,
      ageAtRegistration: healthTbCase.ageAtRegistration,
      homeName: healthTbCase.homeName,
      treatmentRegimen: healthTbCase.treatmentRegimen,
      registrationDate: healthTbCase.registrationDate,
      treatmentStartDate: healthTbCase.treatmentStartDate,
      treatmentEndDate: healthTbCase.treatmentEndDate,
      outcome: healthTbCase.outcome,
      tbType: healthTbCase.tbType,
      caseType: healthTbCase.caseType,
      remarks: healthTbCase.remarks,
    })
      .from(healthTbCase)
      .where(where)
      .orderBy(desc(healthTbCase.registrationDate), sql`${healthTbCase.patientName} collate nocase`)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const summary = summaryRows[0];
  const detailSummary = detailSummaryRows[0];
  const countRow = countRows[0];
  const caseIds = cases.map((record) => record.id);
  const details = caseIds.length
    ? await runtime.ORM.select({
        caseId: healthTbDetail.tbCaseId,
        id: healthTbDetail.id,
        recordedOn: healthTbDetail.recordedOn,
        testName: healthTbDetail.testName,
        result: healthTbDetail.result,
        remarks: healthTbDetail.remarks,
      })
        .from(healthTbDetail)
        .where(
          and(
            eq(healthTbDetail.organizationId, context.organizationId),
            inArray(healthTbDetail.tbCaseId, caseIds),
          ),
        )
    : [];
  const detailsByCase = new Map<string, Array<Omit<(typeof details)[number], "caseId">>>();
  for (const { caseId, ...detail } of details) {
    const values = detailsByCase.get(caseId) ?? [];
    values.push(detail);
    detailsByCase.set(caseId, values);
  }
  const total = Number(countRow?.total ?? 0);
  return Response.json({
    summary: {
      cases: Number(summary?.cases ?? 0),
      details: Number(detailSummary?.details ?? 0),
      linkedPeople: Number(summary?.linkedPeople ?? 0),
      onTreatment: Number(summary?.onTreatment ?? 0),
      firstRegistrationOn: summary?.firstRegistrationOn ?? null,
      lastRegistrationOn: summary?.lastRegistrationOn ?? null,
    },
    outcomes: outcomes.map((item) => ({
      name: item.outcome,
      count: Number(item.count),
    })),
    cases: cases.map((record) => ({
      ...record,
      details: detailsByCase.get(record.id) ?? [],
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
  const runtime = getRuntimeEnv();
  const conditions = [eq(healthMedicalAdvance.organizationId, context.organizationId)];
  if (kind !== "all") {
    const kindDetail = alias(healthMedicalAdvanceDetail, "kind_medical_detail");
    conditions.push(
      exists(
        runtime.ORM.select({ value: sql`1` })
          .from(kindDetail)
          .where(
            and(
              eq(kindDetail.medicalAdvanceId, healthMedicalAdvance.id),
              eq(kindDetail.patientKind, kind),
            ),
          ),
      ),
    );
  }
  if (settlement !== "all") {
    const statusSettlement = alias(healthMedicalSettlement, "status_medical_settlement");
    const settlementExists = exists(
      runtime.ORM.select({ value: sql`1` })
        .from(statusSettlement)
        .where(eq(statusSettlement.medicalAdvanceId, healthMedicalAdvance.id)),
    );
    conditions.push(
      settlement === "settled"
        ? settlementExists
        : notExists(
            runtime.ORM.select({ value: sql`1` })
              .from(statusSettlement)
              .where(eq(statusSettlement.medicalAdvanceId, healthMedicalAdvance.id)),
          ),
    );
  }
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    const searchDetail = alias(healthMedicalAdvanceDetail, "search_medical_detail");
    conditions.push(
      or(
        sql`lower(coalesce(${healthMedicalAdvance.sanctionNumber}, '')) like ${search} escape '\\'`,
        sql`lower(coalesce(${healthMedicalAdvance.nurseName}, '')) like ${search} escape '\\'`,
        sql`lower(coalesce(${healthMedicalAdvance.referringDoctorName}, '')) like ${search} escape '\\'`,
        exists(
          runtime.ORM.select({ value: sql`1` })
            .from(searchDetail)
            .where(
              and(
                eq(searchDetail.medicalAdvanceId, healthMedicalAdvance.id),
                or(
                  sql`lower(${searchDetail.patientName}) like ${search} escape '\\'`,
                  sql`lower(coalesce(${searchDetail.diagnosis}, '')) like ${search} escape '\\'`,
                  sql`lower(coalesce(${searchDetail.medication}, '')) like ${search} escape '\\'`,
                ),
              ),
            ),
        ),
      )!,
    );
  }
  const where = and(...conditions);
  const expenseBySettlement = runtime.ORM.select({
    legacySettlementId: healthMedicalSettlement.legacySettlementId,
    totalExpenses: sql<number>`max(${healthMedicalSettlement.totalExpenses})`.as("total_expenses"),
  })
    .from(healthMedicalSettlement)
    .where(eq(healthMedicalSettlement.organizationId, context.organizationId))
    .groupBy(healthMedicalSettlement.legacySettlementId)
    .as("expense_by_settlement");
  const [
    summaryRows,
    detailSummaryRows,
    settlementSummaryRows,
    expenseSummaryRows,
    countRows,
    advances,
  ] = await runtime.ORM.batch([
    runtime.ORM.select({
      advances: count(),
      advanceAmount: sql<number>`sum(${healthMedicalAdvance.advanceAmount})`,
      firstSanctionOn: sql<string | null>`min(${healthMedicalAdvance.sanctionedOn})`,
      lastSanctionOn: sql<string | null>`max(${healthMedicalAdvance.sanctionedOn})`,
    })
      .from(healthMedicalAdvance)
      .where(eq(healthMedicalAdvance.organizationId, context.organizationId)),
    runtime.ORM.select({ patientAllocations: count() })
      .from(healthMedicalAdvanceDetail)
      .where(eq(healthMedicalAdvanceDetail.organizationId, context.organizationId)),
    runtime.ORM.select({
      settlements: sql<number>`count(distinct ${healthMedicalSettlement.legacySettlementId})`,
      settlementLinks: count(),
    })
      .from(healthMedicalSettlement)
      .where(eq(healthMedicalSettlement.organizationId, context.organizationId)),
    runtime.ORM.select({
      totalExpenses: sql<number>`sum(${expenseBySettlement.totalExpenses})`,
    }).from(expenseBySettlement),
    runtime.ORM.select({ total: count() }).from(healthMedicalAdvance).where(where),
    runtime.ORM.select({
      id: healthMedicalAdvance.id,
      sanctionedOn: healthMedicalAdvance.sanctionedOn,
      nurseName: healthMedicalAdvance.nurseName,
      sanctionNumber: healthMedicalAdvance.sanctionNumber,
      advanceAmount: healthMedicalAdvance.advanceAmount,
      referringDoctorName: healthMedicalAdvance.referringDoctorName,
      referralLocation: healthMedicalAdvance.referralLocation,
      remarks: healthMedicalAdvance.remarks,
    })
      .from(healthMedicalAdvance)
      .where(where)
      .orderBy(desc(healthMedicalAdvance.sanctionedOn), healthMedicalAdvance.sanctionNumber)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);
  const summary = summaryRows[0];
  const detailSummary = detailSummaryRows[0];
  const settlementSummary = settlementSummaryRows[0];
  const expenseSummary = expenseSummaryRows[0];
  const countRow = countRows[0];
  const advanceIds = advances.map((advance) => advance.id);
  const [details, settlements] = advanceIds.length
    ? await runtime.ORM.batch([
        runtime.ORM.select({
          medicalAdvanceId: healthMedicalAdvanceDetail.medicalAdvanceId,
          id: healthMedicalAdvanceDetail.id,
          personId: healthMedicalAdvanceDetail.personId,
          patientName: healthMedicalAdvanceDetail.patientName,
          patientKind: healthMedicalAdvanceDetail.patientKind,
          sanctionType: healthMedicalAdvanceDetail.sanctionType,
          homeName: healthMedicalAdvanceDetail.homeName,
          gender: healthMedicalAdvanceDetail.gender,
          ageAtSanction: healthMedicalAdvanceDetail.ageAtSanction,
          medication: healthMedicalAdvanceDetail.medication,
          referredToDoctorName: healthMedicalAdvanceDetail.referredToDoctorName,
          hospitalRegistrationNumber: healthMedicalAdvanceDetail.hospitalRegistrationNumber,
          hospitalReferredTo: healthMedicalAdvanceDetail.hospitalReferredTo,
          hospitalAdmitted: healthMedicalAdvanceDetail.hospitalAdmitted,
          diagnosis: healthMedicalAdvanceDetail.diagnosis,
          admittedOn: healthMedicalAdvanceDetail.admittedOn,
          dischargedOn: healthMedicalAdvanceDetail.dischargedOn,
          surgeryType: healthMedicalAdvanceDetail.surgeryType,
          amount: healthMedicalAdvanceDetail.amount,
          remarks: healthMedicalAdvanceDetail.remarks,
        })
          .from(healthMedicalAdvanceDetail)
          .where(inArray(healthMedicalAdvanceDetail.medicalAdvanceId, advanceIds)),
        runtime.ORM.select({
          medicalAdvanceId: healthMedicalSettlement.medicalAdvanceId,
          id: healthMedicalSettlement.id,
          settledOn: healthMedicalSettlement.settledOn,
          billNumber: healthMedicalSettlement.billNumber,
          nurseTada: healthMedicalSettlement.nurseTada,
          totalExpenses: healthMedicalSettlement.totalExpenses,
          extraExpenses: healthMedicalSettlement.extraExpenses,
          balance: healthMedicalSettlement.balance,
          remarks: healthMedicalSettlement.remarks,
        })
          .from(healthMedicalSettlement)
          .where(inArray(healthMedicalSettlement.medicalAdvanceId, advanceIds)),
      ])
    : [[], []];
  const detailsByAdvance = new Map<string, Array<Record<string, unknown>>>();
  for (const { medicalAdvanceId, ...detail } of details) {
    const values = detailsByAdvance.get(medicalAdvanceId) ?? [];
    values.push(detail);
    detailsByAdvance.set(medicalAdvanceId, values);
  }
  const settlementsByAdvance = new Map<string, Array<Record<string, unknown>>>();
  for (const { medicalAdvanceId, ...settlementRow } of settlements) {
    const values = settlementsByAdvance.get(medicalAdvanceId) ?? [];
    values.push(settlementRow);
    settlementsByAdvance.set(medicalAdvanceId, values);
  }
  const total = Number(countRow?.total ?? 0);
  return Response.json({
    summary: {
      advances: Number(summary?.advances ?? 0),
      advanceAmount: Number(summary?.advanceAmount ?? 0),
      patientAllocations: Number(detailSummary?.patientAllocations ?? 0),
      settlements: Number(settlementSummary?.settlements ?? 0),
      settlementLinks: Number(settlementSummary?.settlementLinks ?? 0),
      totalExpenses: Number(expenseSummary?.totalExpenses ?? 0),
      firstSanctionOn: summary?.firstSanctionOn ?? null,
      lastSanctionOn: summary?.lastSanctionOn ?? null,
    },
    advances: advances.map((advance) => ({
      ...advance,
      details: detailsByAdvance.get(advance.id) ?? [],
      settlements: settlementsByAdvance.get(advance.id) ?? [],
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

async function getSchoolSessionScope(request: Request, sessionId: string) {
  const context = await getMembershipContext(request);
  if (!context) return null;
  if (!hasPermission(context, "school.read")) return null;
  const runtime = getRuntimeEnv();
  const session = await runtime.ORM.select({
    id: academicSession.id,
    name: academicSession.name,
    startsOn: academicSession.startsOn,
    endsOn: academicSession.endsOn,
  })
    .from(academicSession)
    .where(
      and(
        eq(academicSession.id, sessionId),
        eq(academicSession.organizationId, context.organizationId),
        eq(academicSession.isActive, 1),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
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

  const runtime = getRuntimeEnv();
  return Response.json(await findPeopleRegistry(runtime.ORM, context.organizationId, parsed.data));
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
  const relatedPerson = alias(person, "related_person");
  const rankedEndChanges = runtime.ORM.select({
    enrollmentId: studentEnrollmentChange.enrollmentId,
    effectiveOn: studentEnrollmentChange.effectiveOn,
    note: studentEnrollmentChange.note,
    rank: sql<number>`row_number() over (partition by ${studentEnrollmentChange.enrollmentId} order by ${studentEnrollmentChange.createdAt} desc)`.as(
      "change_rank",
    ),
  })
    .from(studentEnrollmentChange)
    .where(
      and(
        eq(studentEnrollmentChange.organizationId, context.organizationId),
        inArray(studentEnrollmentChange.changeType, ["withdrawn", "completed", "transferred"]),
      ),
    )
    .as("ranked_end_change");
  const latestEndChange = runtime.ORM.select({
    enrollmentId: rankedEndChanges.enrollmentId,
    effectiveOn: rankedEndChanges.effectiveOn,
    note: rankedEndChanges.note,
  })
    .from(rankedEndChanges)
    .where(eq(rankedEndChanges.rank, 1))
    .as("latest_end_change");
  const reciprocalRelationships = runtime.ORM.select({
    id: personRelationship.id,
    relationshipType: personRelationship.relationshipType,
    reviewFlag: personRelationship.reviewFlag,
    sourceId: personRelationship.sourceId,
    counterpartId:
      sql<string>`case when ${personRelationship.personId} = ${parsedId.data} then ${personRelationship.relatedPersonId} else ${personRelationship.personId} end`.as(
        "counterpart_id",
      ),
  })
    .from(personRelationship)
    .where(
      and(
        eq(personRelationship.organizationId, context.organizationId),
        eq(personRelationship.relationshipType, "sibling"),
        eq(personRelationship.isActive, 1),
        or(
          eq(personRelationship.personId, parsedId.data),
          eq(personRelationship.relatedPersonId, parsedId.data),
        ),
      ),
    )
    .as("reciprocal_relationship");
  const [
    personRows,
    placements,
    academicRecords,
    schoolEnrollments,
    familyProfileRows,
    relationships,
    files,
  ] = await Promise.all([
    runtime.ORM.select({
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
      educationNumber: person.educationNumber,
      registrationCertificateNumber: person.registrationCertificateNumber,
      identityCertificateNumber: person.identityCertificateNumber,
      photoReferencePresent: sql<number>`case when ${person.photoAssetKey} is null then 0 else 1 end`,
      sourceSystem: person.sourceSystem,
      sourceTable: person.sourceTable,
      sourceId: person.sourceId,
      importedAt: person.importedAt,
      dateOfBirthMissing: sql<number>`case when ${person.dateOfBirth} is null then 1 else 0 end`,
      eventDateMissing: sql<number>`case when ${person.admittedOrJoinedOn} is null then 1 else 0 end`,
      eventDateBefore1900: sql<number>`case when date(${person.admittedOrJoinedOn}) < '1900-01-01' then 1 else 0 end`,
      eventBeforeBirth: sql<number>`case when date(${person.admittedOrJoinedOn}) < date(${person.dateOfBirth}) then 1 else 0 end`,
    })
      .from(person)
      .where(and(eq(person.id, parsedId.data), eq(person.organizationId, context.organizationId)))
      .limit(1),
    runtime.ORM.select({
      id: personPlacement.id,
      homeName: personPlacement.homeName,
      locationName: personPlacement.locationName,
      placementType: personPlacement.placementType,
      startedOn: personPlacement.startedOn,
      endedOn: personPlacement.endedOn,
      reason: personPlacement.reason,
      remarks: personPlacement.remarks,
      isCurrent: personPlacement.isCurrent,
      sourceId: personPlacement.sourceId,
    })
      .from(personPlacement)
      .where(
        and(
          eq(personPlacement.personId, parsedId.data),
          eq(personPlacement.organizationId, context.organizationId),
        ),
      )
      .orderBy(
        desc(personPlacement.isCurrent),
        desc(sql`date(${personPlacement.startedOn})`),
        desc(sql`cast(${personPlacement.sourceId} as integer)`),
      ),
    runtime.ORM.select({
      id: personAcademicRecord.id,
      className: personAcademicRecord.className,
      classLevel: personAcademicRecord.classLevel,
      classSection: personAcademicRecord.classSection,
      classTitle: personAcademicRecord.classTitle,
      schoolName: personAcademicRecord.schoolName,
      houseName: personAcademicRecord.houseName,
      academicSession: personAcademicRecord.academicSession,
      recordedOn: personAcademicRecord.recordedOn,
      result: personAcademicRecord.result,
      rollNumber: personAcademicRecord.rollNumber,
      boardRegistrationNumber: personAcademicRecord.boardRegistrationNumber,
      description: personAcademicRecord.description,
      isLatest: personAcademicRecord.isLatest,
      sourceId: personAcademicRecord.sourceId,
    })
      .from(personAcademicRecord)
      .where(
        and(
          eq(personAcademicRecord.personId, parsedId.data),
          eq(personAcademicRecord.organizationId, context.organizationId),
        ),
      )
      .orderBy(
        desc(personAcademicRecord.isLatest),
        desc(sql`date(${personAcademicRecord.recordedOn})`),
        desc(sql`cast(${personAcademicRecord.sourceId} as integer)`),
      ),
    runtime.ORM.select({
      id: studentEnrollment.id,
      academicSession: academicSession.name,
      sessionStartsOn: academicSession.startsOn,
      sessionEndsOn: academicSession.endsOn,
      schoolName: schoolMaster.name,
      className: sql<string>`case when ${academicClassMaster.section} is null or trim(${academicClassMaster.section}) = '' then ${academicClassMaster.name} else ${academicClassMaster.name} || ' · ' || ${academicClassMaster.section} end`,
      houseName: houseMaster.name,
      rollNumber: studentEnrollment.rollNumber,
      status: studentEnrollment.status,
      startedOn: studentEnrollment.startedOn,
      endedOn: sql<
        string | null
      >`coalesce(${latestEndChange.effectiveOn}, ${studentEnrollment.endedOn})`,
      endReason: latestEndChange.note,
    })
      .from(studentEnrollment)
      .innerJoin(
        academicSession,
        and(
          eq(academicSession.id, studentEnrollment.academicSessionId),
          eq(academicSession.organizationId, studentEnrollment.organizationId),
        ),
      )
      .innerJoin(
        academicClassMaster,
        and(
          eq(academicClassMaster.id, studentEnrollment.academicClassId),
          eq(academicClassMaster.organizationId, studentEnrollment.organizationId),
        ),
      )
      .leftJoin(
        schoolMaster,
        and(
          eq(schoolMaster.id, studentEnrollment.schoolId),
          eq(schoolMaster.organizationId, studentEnrollment.organizationId),
        ),
      )
      .leftJoin(
        houseMaster,
        and(
          eq(houseMaster.id, studentEnrollment.houseId),
          eq(houseMaster.organizationId, studentEnrollment.organizationId),
        ),
      )
      .leftJoin(latestEndChange, eq(latestEndChange.enrollmentId, studentEnrollment.id))
      .where(
        and(
          eq(studentEnrollment.personId, parsedId.data),
          eq(studentEnrollment.organizationId, context.organizationId),
        ),
      )
      .orderBy(desc(sql`date(${academicSession.startsOn})`), desc(studentEnrollment.createdAt)),
    runtime.ORM.select({
      parentageStatus: personFamilyProfile.parentageStatus,
      motherName: personFamilyProfile.motherName,
      fatherName: personFamilyProfile.fatherName,
      motherOccupation: personFamilyProfile.motherOccupation,
      fatherOccupation: personFamilyProfile.fatherOccupation,
      parentsPhone: personFamilyProfile.parentsPhone,
      parentsPermanentAddress: personFamilyProfile.parentsPermanentAddress,
      guardian1Name: personFamilyProfile.guardian1Name,
      guardian1Address: personFamilyProfile.guardian1Address,
      guardian1Email: personFamilyProfile.guardian1Email,
      guardian1Phone: personFamilyProfile.guardian1Phone,
      guardian1Mobile: personFamilyProfile.guardian1Mobile,
      guardian2Name: personFamilyProfile.guardian2Name,
      guardian2Address: personFamilyProfile.guardian2Address,
      guardian2Email: personFamilyProfile.guardian2Email,
      guardian2Phone: personFamilyProfile.guardian2Phone,
      guardian2Mobile: personFamilyProfile.guardian2Mobile,
      maritalStatus: personFamilyProfile.maritalStatus,
      spouseName: personFamilyProfile.spouseName,
      numberOfChildren: personFamilyProfile.numberOfChildren,
    })
      .from(personFamilyProfile)
      .where(
        and(
          eq(personFamilyProfile.personId, parsedId.data),
          eq(personFamilyProfile.organizationId, context.organizationId),
        ),
      )
      .limit(1),
    runtime.ORM.select({
      id: reciprocalRelationships.id,
      relationshipType: reciprocalRelationships.relationshipType,
      reviewFlag: reciprocalRelationships.reviewFlag,
      sourceId: reciprocalRelationships.sourceId,
      personId: relatedPerson.id,
      displayName: relatedPerson.displayName,
      primaryIdentifier: relatedPerson.primaryIdentifier,
      identifierKind: relatedPerson.identifierKind,
      kind: relatedPerson.kind,
      status: relatedPerson.status,
    })
      .from(reciprocalRelationships)
      .innerJoin(
        relatedPerson,
        and(
          eq(relatedPerson.id, reciprocalRelationships.counterpartId),
          eq(relatedPerson.organizationId, context.organizationId),
        ),
      )
      .orderBy(
        asc(sql`case when ${reciprocalRelationships.reviewFlag} is null then 1 else 0 end`),
        asc(sql`cast(${reciprocalRelationships.sourceId} as integer)`),
        asc(reciprocalRelationships.id),
      ),
    runtime.ORM.select({
      id: personFile.id,
      category: personFile.category,
      label: personFile.label,
      fileName: personFile.fileName,
      contentType: personFile.contentType,
      byteSize: personFile.byteSize,
      isPrimary: personFile.isPrimary,
    })
      .from(personFile)
      .where(
        and(
          eq(personFile.personId, parsedId.data),
          eq(personFile.organizationId, context.organizationId),
          eq(personFile.isActive, 1),
        ),
      )
      .orderBy(
        asc(
          sql`case ${personFile.category} when 'profile_photo' then 0 when 'parents_photo' then 1 when 'guardian_1_photo' then 2 when 'guardian_2_photo' then 3 else 4 end`,
        ),
        asc(sql`lower(${personFile.label})`),
        asc(personFile.sourceId),
      ),
  ]);
  const personRecord = personRows[0] ?? null;
  const familyProfile = familyProfileRows[0] ?? null;

  if (!personRecord) return Response.json({ error: "Person not found" }, { status: 404 });

  const canEdit = hasPermission(context, "people.update");
  const uniqueRelationships = [
    ...new Map(relationships.map((item) => [item.personId, item])).values(),
  ]
    .map(({ sourceId: _sourceId, ...item }) => item)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));

  const reviewFlags = [
    personRecord.dateOfBirthMissing ? "date_of_birth_missing" : null,
    personRecord.eventDateMissing ? "event_date_missing" : null,
    personRecord.eventDateBefore1900 ? "event_date_before_1900" : null,
    personRecord.eventBeforeBirth ? "event_before_birth" : null,
  ].filter((flag): flag is string => Boolean(flag));

  return Response.json({
    person: {
      id: personRecord.id,
      kind: personRecord.kind,
      status: personRecord.status,
      identifierKind: personRecord.identifierKind,
      primaryIdentifier: personRecord.primaryIdentifier,
      displayName: personRecord.displayName,
      gender: personRecord.gender,
      dateOfBirth: personRecord.dateOfBirth,
      admittedOrJoinedOn: personRecord.admittedOrJoinedOn,
      campusOrLocation: personRecord.campusOrLocation,
      nationality: personRecord.nationality,
      educationNumber: personRecord.educationNumber,
      registrationCertificateNumber: personRecord.registrationCertificateNumber,
      identityCertificateNumber: personRecord.identityCertificateNumber,
      photoReferencePresent: Boolean(personRecord.photoReferencePresent),
      sourceSystem: personRecord.sourceSystem,
      sourceTable: personRecord.sourceTable,
      sourceId: personRecord.sourceId,
      importedAt: personRecord.importedAt,
      canEdit,
      editRestriction: canEdit ? null : "permission",
      reviewFlags,
      placements: placements.map((placement) => ({
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
      academicRecords: academicRecords.map((record) => ({
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
      schoolEnrollments: schoolEnrollments.map((enrollment) => ({
        ...enrollment,
        canCorrectEndDetails:
          canEdit && ["withdrawn", "completed", "graduated"].includes(enrollment.status),
      })),
      family: familyProfile ?? null,
      relationships: uniqueRelationships,
      files: files.map((file) => ({
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
  const current = await runtime.ORM.select({
    id: person.id,
    identifierKind: person.identifierKind,
    primaryIdentifier: person.primaryIdentifier,
    displayName: person.displayName,
    gender: person.gender,
    dateOfBirth: person.dateOfBirth,
    admittedOrJoinedOn: person.admittedOrJoinedOn,
    campusOrLocation: person.campusOrLocation,
    nationality: person.nationality,
    educationNumber: person.educationNumber,
    registrationCertificateNumber: person.registrationCertificateNumber,
    identityCertificateNumber: person.identityCertificateNumber,
    sourceSystem: person.sourceSystem,
  })
    .from(person)
    .where(and(eq(person.id, parsedId.data), eq(person.organizationId, context.organizationId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!current) return Response.json({ error: "Person not found" }, { status: 404 });
  const duplicate = await runtime.ORM.select({ id: person.id })
    .from(person)
    .where(
      and(
        eq(person.organizationId, context.organizationId),
        eq(person.identifierKind, current.identifierKind),
        ne(person.id, parsedId.data),
        eq(sql`lower(${person.primaryIdentifier})`, parsed.data.primaryIdentifier.toLowerCase()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
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
      ["educationNumber", current.educationNumber, next.educationNumber],
      [
        "registrationCertificateNumber",
        current.registrationCertificateNumber,
        next.registrationCertificateNumber,
      ],
      [
        "identityCertificateNumber",
        current.identityCertificateNumber,
        next.identityCertificateNumber,
      ],
    ] as const
  )
    .filter(([, before, after]) => before !== after)
    .map(([field]) => field);

  if (!changedFields.length) {
    return Response.json({ personId: parsedId.data, changedFields });
  }

  try {
    await runtime.ORM.batch([
      runtime.ORM.update(person)
        .set({
          primaryIdentifier: next.primaryIdentifier,
          displayName: next.displayName,
          gender: next.gender,
          dateOfBirth: next.dateOfBirth,
          admittedOrJoinedOn: next.admittedOrJoinedOn,
          campusOrLocation: next.campusOrLocation,
          nationality: next.nationality,
          educationNumber: next.educationNumber,
          registrationCertificateNumber: next.registrationCertificateNumber,
          identityCertificateNumber: next.identityCertificateNumber,
          updatedByUserId: context.userId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(eq(person.id, parsedId.data), eq(person.organizationId, context.organizationId)),
        ),
      auditInsert(runtime.ORM, context, "person.details_updated", "person", parsedId.data, {
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
  const [personRecord, current] = await Promise.all([
    runtime.ORM.select({ id: person.id, kind: person.kind })
      .from(person)
      .where(and(eq(person.id, parsedId.data), eq(person.organizationId, context.organizationId)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    runtime.ORM.select({
      id: personPlacement.id,
      homeName: personPlacement.homeName,
      locationName: personPlacement.locationName,
      placementType: personPlacement.placementType,
      startedOn: personPlacement.startedOn,
    })
      .from(personPlacement)
      .where(
        and(
          eq(personPlacement.personId, parsedId.data),
          eq(personPlacement.organizationId, context.organizationId),
          eq(personPlacement.isCurrent, 1),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  if (!personRecord) return Response.json({ error: "Person not found" }, { status: 404 });
  if (personRecord.kind === "staff") {
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
  const previousPlacementId = current?.id ?? "__no_placement__";
  const statements = [
    runtime.ORM.update(personPlacement)
      .set({
        isCurrent: 0,
        endedOn: placement.startedOn,
        updatedByUserId: context.userId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(personPlacement.id, previousPlacementId),
          eq(personPlacement.organizationId, context.organizationId),
          eq(personPlacement.isCurrent, 1),
        ),
      ),
    runtime.ORM.insert(personPlacement).values({
      id: placementId,
      organizationId: context.organizationId,
      personId: parsedId.data,
      homeName: placement.homeName,
      locationName: placement.locationName,
      placementType: placement.placementType,
      startedOn: placement.startedOn,
      reason: placement.reason,
      remarks: placement.remarks,
      isCurrent: 1,
      sourceSystem: "tsewa",
      sourceTable: "person_placement",
      sourceId: placementId,
      createdByUserId: context.userId,
      updatedByUserId: context.userId,
    }),
    runtime.ORM.update(person)
      .set({
        campusOrLocation: placement.locationName ?? placement.homeName,
        updatedByUserId: context.userId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(person.id, parsedId.data), eq(person.organizationId, context.organizationId))),
    auditInsert(runtime.ORM, context, "person.home_placement_changed", "person", parsedId.data, {
      placementId,
      previousPlacementId: current?.id ?? "none",
      homeName: placement.homeName,
      startedOn: placement.startedOn,
    }),
  ] as const;

  try {
    await runtime.ORM.batch(statements);
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
  const personRecord = await runtime.ORM.select({ id: person.id })
    .from(person)
    .where(and(eq(person.id, parsedId.data), eq(person.organizationId, context.organizationId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!personRecord) return Response.json({ error: "Person not found" }, { status: 404 });

  const current = await runtime.ORM.query.personFamilyProfile.findFirst({
    where: and(
      eq(personFamilyProfile.personId, parsedId.data),
      eq(personFamilyProfile.organizationId, context.organizationId),
    ),
  });

  const familyFieldNames = Object.keys(parsed.data) as Array<keyof typeof parsed.data>;
  const changedFields = familyFieldNames.filter(
    (field) => (current?.[field] ?? null) !== parsed.data[field],
  );
  if (!changedFields.length) {
    return Response.json({ personId: parsedId.data, changedFields });
  }

  const profileId = current?.id ?? crypto.randomUUID();
  const details = parsed.data;
  await runtime.ORM.batch([
    runtime.ORM.insert(personFamilyProfile)
      .values({
        id: profileId,
        organizationId: context.organizationId,
        personId: parsedId.data,
        ...details,
        sourceSystem: "tsewa",
        sourceTable: "person_family_profile",
        sourceId: profileId,
        updatedByUserId: context.userId,
      })
      .onConflictDoUpdate({
        target: [personFamilyProfile.organizationId, personFamilyProfile.personId],
        set: { ...details, updatedByUserId: context.userId, updatedAt: sql`CURRENT_TIMESTAMP` },
      }),
    auditInsert(runtime.ORM, context, "person.family_updated", "person", parsedId.data, {
      changedFields: changedFields.join(","),
      sourceSystem: current?.sourceSystem ?? "tsewa",
    }),
  ]);

  return Response.json({ personId: parsedId.data, changedFields });
}

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
  const personRecord = await runtime.ORM.select({ id: person.id })
    .from(person)
    .where(and(eq(person.id, parsedId.data), eq(person.organizationId, context.organizationId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!personRecord) return Response.json({ error: "Person not found" }, { status: 404 });

  const candidate = alias(person, "candidate");
  const existingRelationship = runtime.ORM.select({ value: sql<number>`1` })
    .from(personRelationship)
    .where(
      and(
        eq(personRelationship.organizationId, context.organizationId),
        eq(personRelationship.relationshipType, "sibling"),
        eq(personRelationship.isActive, 1),
        or(
          and(
            eq(personRelationship.personId, parsedId.data),
            eq(personRelationship.relatedPersonId, candidate.id),
          ),
          and(
            eq(personRelationship.relatedPersonId, parsedId.data),
            eq(personRelationship.personId, candidate.id),
          ),
        ),
      ),
    );
  const conditions = [
    eq(candidate.organizationId, context.organizationId),
    ne(candidate.id, parsedId.data),
    notExists(existingRelationship),
  ];
  if (parsedQuery.data.q) {
    const search = `%${escapeLikePattern(parsedQuery.data.q.toLowerCase())}%`;
    conditions.push(
      or(
        sql`lower(${candidate.displayName}) LIKE ${search} ESCAPE '\\'`,
        sql`lower(${candidate.primaryIdentifier}) LIKE ${search} ESCAPE '\\'`,
      )!,
    );
  }

  const candidates = await runtime.ORM.select({
    id: candidate.id,
    displayName: candidate.displayName,
    primaryIdentifier: candidate.primaryIdentifier,
    identifierKind: candidate.identifierKind,
    kind: candidate.kind,
    status: candidate.status,
  })
    .from(candidate)
    .where(and(...conditions))
    .orderBy(asc(sql`lower(${candidate.displayName})`), asc(candidate.primaryIdentifier))
    .limit(20);

  return Response.json({ people: candidates });
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
  const personRecord = await runtime.ORM.select({ id: person.id })
    .from(person)
    .where(and(eq(person.id, parsedId.data), eq(person.organizationId, context.organizationId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!personRecord) return Response.json({ error: "Person not found" }, { status: 404 });

  let relatedPersonId: string;
  let createdPersonId: string | null = null;
  if (parsed.data.mode === "existing") {
    if (parsed.data.relatedPersonId === parsedId.data) {
      return Response.json({ error: "A person cannot be their own sibling." }, { status: 400 });
    }
    const related = await runtime.ORM.select({ id: person.id })
      .from(person)
      .where(
        and(
          eq(person.id, parsed.data.relatedPersonId),
          eq(person.organizationId, context.organizationId),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
    if (!related) return Response.json({ error: "Sibling not found" }, { status: 404 });
    relatedPersonId = related.id;
  } else {
    const duplicate = await runtime.ORM.select({ id: person.id })
      .from(person)
      .where(
        and(
          eq(person.organizationId, context.organizationId),
          eq(person.identifierKind, "admission"),
          eq(sql`lower(${person.primaryIdentifier})`, parsed.data.primaryIdentifier.toLowerCase()),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
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

  const existing = await runtime.ORM.select({ id: personRelationship.id })
    .from(personRelationship)
    .where(
      and(
        eq(personRelationship.organizationId, context.organizationId),
        eq(personRelationship.relationshipType, "sibling"),
        eq(personRelationship.isActive, 1),
        or(
          and(
            eq(personRelationship.personId, parsedId.data),
            eq(personRelationship.relatedPersonId, relatedPersonId),
          ),
          and(
            eq(personRelationship.personId, relatedPersonId),
            eq(personRelationship.relatedPersonId, parsedId.data),
          ),
        ),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (existing)
    return Response.json(
      { error: "These people are already linked as siblings." },
      { status: 409 },
    );

  const relationshipId = crypto.randomUUID();
  if (parsed.data.mode === "new") {
    await runtime.ORM.batch([
      runtime.ORM.insert(person).values({
        id: relatedPersonId,
        organizationId: context.organizationId,
        kind: "child",
        status: "active",
        identifierKind: "admission",
        primaryIdentifier: parsed.data.primaryIdentifier,
        displayName: parsed.data.displayName,
        gender: parsed.data.gender,
        sourceSystem: "tsewa",
        sourceTable: "person",
        sourceId: relatedPersonId,
        createdByUserId: context.userId,
        updatedByUserId: context.userId,
      }),
      auditInsert(runtime.ORM, context, "person.created_as_sibling", "person", relatedPersonId, {
        linkedFromPersonId: parsedId.data,
      }),
    ]);
  }
  await runtime.ORM.batch([
    runtime.ORM.insert(personRelationship).values({
      id: relationshipId,
      organizationId: context.organizationId,
      personId: parsedId.data,
      relatedPersonId,
      relationshipType: "sibling",
      sourceSystem: "tsewa",
      sourceTable: "person_relationship",
      sourceId: relationshipId,
      updatedByUserId: context.userId,
    }),
    auditInsert(
      runtime.ORM,
      context,
      "person.sibling_added",
      "person_relationship",
      relationshipId,
      {
        personId: parsedId.data,
        relatedPersonId,
      },
    ),
  ]);

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
  const relationship = await runtime.ORM.select({
    id: personRelationship.id,
    personId: personRelationship.personId,
    relatedPersonId: personRelationship.relatedPersonId,
  })
    .from(personRelationship)
    .where(
      and(
        eq(personRelationship.id, parsedRelationshipId.data),
        eq(personRelationship.organizationId, context.organizationId),
        eq(personRelationship.relationshipType, "sibling"),
        eq(personRelationship.isActive, 1),
        or(
          eq(personRelationship.personId, parsedPersonId.data),
          eq(personRelationship.relatedPersonId, parsedPersonId.data),
        ),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!relationship) return Response.json({ error: "Sibling link not found." }, { status: 404 });

  const relatedPersonId =
    relationship.personId === parsedPersonId.data
      ? relationship.relatedPersonId
      : relationship.personId;
  const pairCondition = or(
    and(
      eq(personRelationship.personId, parsedPersonId.data),
      eq(personRelationship.relatedPersonId, relatedPersonId),
    ),
    and(
      eq(personRelationship.personId, relatedPersonId),
      eq(personRelationship.relatedPersonId, parsedPersonId.data),
    ),
  );
  const relationshipCount = await runtime.ORM.select({ total: count() })
    .from(personRelationship)
    .where(
      and(
        eq(personRelationship.organizationId, context.organizationId),
        eq(personRelationship.relationshipType, "sibling"),
        eq(personRelationship.isActive, 1),
        pairCondition,
      ),
    )
    .then((rows) => rows[0] ?? { total: 0 });

  await runtime.ORM.batch([
    runtime.ORM.update(personRelationship)
      .set({
        isActive: 0,
        removedAt: sql`CURRENT_TIMESTAMP`,
        updatedByUserId: context.userId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(personRelationship.organizationId, context.organizationId),
          eq(personRelationship.relationshipType, "sibling"),
          eq(personRelationship.isActive, 1),
          pairCondition,
        ),
      ),
    auditInsert(
      runtime.ORM,
      context,
      "person.sibling_removed",
      "person_relationship",
      relationship.id,
      {
        personId: parsedPersonId.data,
        relatedPersonId,
        hiddenSourceRows: String(Number(relationshipCount.total)),
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
  const file = await runtime.ORM.select({
    r2ObjectKey: personFile.r2ObjectKey,
    fileName: personFile.fileName,
    contentType: personFile.contentType,
    byteSize: personFile.byteSize,
  })
    .from(personFile)
    .where(
      and(
        eq(personFile.id, parsedId.data),
        eq(personFile.organizationId, context.organizationId),
        eq(personFile.isActive, 1),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
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
  const personRecord = await runtime.ORM.select({ id: person.id })
    .from(person)
    .where(
      and(eq(person.id, parsedPersonId.data), eq(person.organizationId, context.organizationId)),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!personRecord) return Response.json({ error: "Person not found" }, { status: 404 });

  const parsed = await parsePersonFileForm(request);
  if (parsed instanceof Response) return parsed;

  if (parsed.category !== "document") {
    const existing = await runtime.ORM.select({ id: personFile.id })
      .from(personFile)
      .where(
        and(
          eq(personFile.organizationId, context.organizationId),
          eq(personFile.personId, parsedPersonId.data),
          eq(personFile.category, parsed.category),
          eq(personFile.isActive, 1),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null);
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
  const existing = await runtime.ORM.select({
    id: personFile.id,
    category: personFile.category,
    label: personFile.label,
    fileName: personFile.fileName,
    r2ObjectKey: personFile.r2ObjectKey,
  })
    .from(personFile)
    .where(
      and(
        eq(personFile.id, parsedFileId.data),
        eq(personFile.personId, parsedPersonId.data),
        eq(personFile.organizationId, context.organizationId),
        eq(personFile.isActive, 1),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
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
    await runtime.ORM.batch([
      runtime.ORM.update(personFile)
        .set({
          label: input.data,
          updatedByUserId: context.userId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(personFile.id, existing.id),
            eq(personFile.organizationId, context.organizationId),
            eq(personFile.isActive, 1),
          ),
        ),
      auditInsert(runtime.ORM, context, "person.file_renamed", "person_file", existing.id, {
        personId: parsedPersonId.data,
        previousName: existing.label,
        name: input.data,
      }),
    ]);
    return Response.json({ ok: true });
  }

  if (request.method === "POST") {
    const existingCategory = personFileCategorySchema.parse(existing.category);
    const parsed = await parsePersonFileForm(request, existingCategory);
    if (parsed instanceof Response) return parsed;
    const response = await storePersonFile(runtime, context, parsedPersonId.data, parsed, existing);
    if (response.ok) await runtime.FILES.delete(existing.r2ObjectKey);
    return response;
  }

  if (request.method === "DELETE") {
    const profilePersonId =
      existing.category === "profile_photo" ? parsedPersonId.data : "__no_person__";
    await runtime.ORM.batch([
      runtime.ORM.update(personFile)
        .set({
          isActive: 0,
          removedAt: sql`CURRENT_TIMESTAMP`,
          updatedByUserId: context.userId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(personFile.id, existing.id),
            eq(personFile.organizationId, context.organizationId),
            eq(personFile.isActive, 1),
          ),
        ),
      runtime.ORM.update(person)
        .set({ photoAssetKey: null, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(eq(person.id, profilePersonId), eq(person.organizationId, context.organizationId)),
        ),
      auditInsert(runtime.ORM, context, "person.file_removed", "person_file", existing.id, {
        personId: parsedPersonId.data,
        name: existing.label,
        category: existing.category,
      }),
    ]);
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
    const replacedFileId = replaced?.id ?? "__no_file__";
    const profilePersonId = input.category === "profile_photo" ? personId : "__no_person__";
    await runtime.ORM.batch([
      runtime.ORM.update(personFile)
        .set({
          isActive: 0,
          removedAt: sql`CURRENT_TIMESTAMP`,
          updatedByUserId: context.userId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            eq(personFile.id, replacedFileId),
            eq(personFile.organizationId, context.organizationId),
            eq(personFile.isActive, 1),
          ),
        ),
      runtime.ORM.insert(personFile).values({
        id,
        organizationId: context.organizationId,
        personId,
        category: input.category,
        label: input.name,
        fileName: input.file.name,
        contentType: input.file.type,
        byteSize: input.file.size,
        sha256,
        r2ObjectKey: objectKey,
        isPrimary: input.category === "profile_photo" ? 1 : 0,
        sourceSystem: "tsewa",
        sourceTable: "person_file",
        sourceId: id,
        sourceAssetId: id,
        createdByUserId: context.userId,
        updatedByUserId: context.userId,
        replacesFileId: replaced?.id ?? null,
      }),
      runtime.ORM.update(person)
        .set({ photoAssetKey: objectKey, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(
          and(eq(person.id, profilePersonId), eq(person.organizationId, context.organizationId)),
        ),
      auditInsert(
        runtime.ORM,
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
    ]);
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
  if (!context) {
    const [userCountRows, sessions] = await Promise.all([
      runtime.ORM.select({ count: count() }).from(user),
      runtime.ORM.select({
        id: academicSession.id,
        name: academicSession.name,
        startsOn: academicSession.startsOn,
        endsOn: academicSession.endsOn,
      })
        .from(academicSession)
        .innerJoin(organization, eq(organization.id, academicSession.organizationId))
        .where(
          and(
            eq(organization.slug, runtime.DEFAULT_ORGANIZATION_SLUG),
            eq(academicSession.isActive, 1),
          ),
        )
        .orderBy(desc(academicSession.startsOn)),
    ]);
    return Response.json({
      needsSetup: Number(userCountRows[0]?.count ?? 0) === 0,
      sessions,
      activeSessionId: sessions[0]?.id ?? null,
      activeOrganizationId: null,
      organizations: [],
    });
  }

  const [sessions, membershipRows] = await Promise.all([
    runtime.ORM.select({
      id: academicSession.id,
      name: academicSession.name,
      startsOn: academicSession.startsOn,
      endsOn: academicSession.endsOn,
    })
      .from(academicSession)
      .where(
        and(
          eq(academicSession.organizationId, context.organizationId),
          eq(academicSession.isActive, 1),
        ),
      )
      .orderBy(desc(academicSession.startsOn)),
    runtime.ORM.select({
      id: organization.id,
      name: organization.name,
      displayTitle: organization.displayTitle,
      logoAssetKey: organization.logoAssetKey,
      updatedAt: organization.updatedAt,
      group: sql<AccessGroupKey>`coalesce(${accessGroup.key}, ${organizationMember.role})`,
      defaultSessionId: academicSession.id,
    })
      .from(organizationMember)
      .innerJoin(organization, eq(organization.id, organizationMember.organizationId))
      .leftJoin(accessGroup, eq(accessGroup.id, organizationMember.groupId))
      .leftJoin(
        academicSession,
        and(eq(academicSession.organizationId, organization.id), eq(academicSession.isActive, 1)),
      )
      .where(eq(organizationMember.userId, context.userId))
      .orderBy(asc(sql`lower(${organization.name})`), desc(academicSession.startsOn)),
  ]);
  const memberships = new Map<string, (typeof membershipRows)[number]>();
  for (const membership of membershipRows) {
    if (!memberships.has(membership.id)) memberships.set(membership.id, membership);
  }
  return Response.json({
    needsSetup: false,
    sessions,
    activeSessionId: context?.activeSessionId ?? sessions[0]?.id ?? null,
    activeOrganizationId: context.organizationId,
    organizations: [...memberships.values()].map((membership) => ({
      ...membership,
      logoUrl: membership.logoAssetKey
        ? `/api/organization/logo?v=${encodeURIComponent(membership.updatedAt)}`
        : null,
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

async function getDashboard(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  const parsed = dashboardQuerySchema.safeParse({
    sessionId: new URL(request.url).searchParams.get("sessionId"),
  });
  if (!parsed.success) {
    return Response.json({ error: "Select a valid academic session." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const dashboard = await findDashboard(
    runtime.ORM,
    context.organizationId,
    parsed.data.sessionId,
    context.permissions,
  );
  if (!dashboard) {
    return Response.json({ error: "Academic session not found." }, { status: 404 });
  }
  return Response.json(dashboard);
}

async function recordReportExport(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  const parsed = reportExportAuditSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Invalid report export." }, { status: 400 });
  const permission = parsed.data.domain === "scholarship" ? "scholarship.read" : "sponsorship.read";
  if (!hasPermission(context, permission)) return forbidden();
  const runtime = getRuntimeEnv();
  await auditInsert(
    runtime.ORM,
    context,
    "report.exported",
    "report",
    `${parsed.data.domain}:${parsed.data.report}`,
    parsed.data,
  );
  return Response.json({ ok: true }, { status: 201 });
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
  const [organizationRows, members, invitations, groups, roles, rolePermissions, groupRoles] =
    await runtime.ORM.batch([
      runtime.ORM.select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        displayTitle: organization.displayTitle,
        logoAssetKey: organization.logoAssetKey,
        timezone: organization.timezone,
        locale: organization.locale,
        updatedAt: organization.updatedAt,
      })
        .from(organization)
        .where(eq(organization.id, context.organizationId))
        .limit(1),
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
  const organizationState = organizationRows[0] ?? null;

  if (!organizationState)
    return Response.json({ error: "Organization not found" }, { status: 404 });

  const permissionKeysByRole = new Map<string, PermissionKey[]>();
  for (const mapping of rolePermissions) {
    const permissionKeys = permissionKeysByRole.get(mapping.roleKey) ?? [];
    permissionKeys.push(mapping.permissionKey as PermissionKey);
    permissionKeysByRole.set(mapping.roleKey, permissionKeys);
  }
  const roleKeysByGroup = new Map<string, AccessRoleKey[]>();
  for (const mapping of groupRoles) {
    const roleKeys = roleKeysByGroup.get(mapping.groupKey) ?? [];
    roleKeys.push(mapping.roleKey as AccessRoleKey);
    roleKeysByGroup.set(mapping.groupKey, roleKeys);
  }

  return Response.json({
    organization: {
      ...organizationState,
      logoUrl: organizationState.logoAssetKey
        ? `/api/organization/logo?v=${encodeURIComponent(organizationState.updatedAt)}`
        : null,
    },
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
        permissionKeys: permissionKeysByRole.get(role.key) ?? [],
      })),
      groups: groups.map((group) => ({
        ...group,
        roleKeys: roleKeysByGroup.get(group.key) ?? [],
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
        displayTitle: parsed.data.displayTitle,
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
        displayTitle: parsed.data.displayTitle,
        timezone: parsed.data.timezone,
        locale: parsed.data.locale,
      },
    ),
  ]);

  return Response.json({ ok: true });
}

const MAX_ORGANIZATION_LOGO_BYTES = 2 * 1024 * 1024;

async function handleOrganizationLogo(request: Request): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  const runtime = getRuntimeEnv();
  const current = await runtime.ORM.select({
    logoAssetKey: organization.logoAssetKey,
    updatedAt: organization.updatedAt,
  })
    .from(organization)
    .where(eq(organization.id, context.organizationId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!current) return Response.json({ error: "Organization not found." }, { status: 404 });

  if (request.method === "GET") {
    if (!current.logoAssetKey)
      return Response.json({ error: "Organization logo not found." }, { status: 404 });
    const object = await runtime.FILES.get(current.logoAssetKey);
    if (!object) return Response.json({ error: "Stored logo not found." }, { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Length", String(object.size));
    headers.set("Content-Disposition", "inline");
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("ETag", object.httpEtag);
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(object.body, { headers });
  }

  if (!isSameOrigin(request)) return forbidden();
  if (!hasPermission(context, "organization.settings.manage")) return forbidden();

  if (request.method === "DELETE") {
    if (!current.logoAssetKey) return Response.json({ ok: true });
    await runtime.ORM.batch([
      runtime.ORM.update(organization)
        .set({ logoAssetKey: null, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(organization.id, context.organizationId)),
      auditInsert(
        runtime.ORM,
        context,
        "organization.logo_removed",
        "organization",
        context.organizationId,
      ),
    ]);
    await runtime.FILES.delete(current.logoAssetKey);
    return Response.json({ ok: true });
  }

  if (request.method !== "POST") return methodNotAllowed("GET, POST, DELETE");
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a logo file." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_ORGANIZATION_LOGO_BYTES) {
    return Response.json({ error: "Logos must be between 1 byte and 2 MB." }, { status: 400 });
  }
  if (!PHOTO_CONTENT_TYPES.has(file.type)) {
    return Response.json({ error: "Use a JPEG, PNG, or WebP logo." }, { status: 400 });
  }

  const objectKey = `organizations/${context.organizationId}/profile/logo-${crypto.randomUUID()}`;
  await runtime.FILES.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  try {
    await runtime.ORM.batch([
      runtime.ORM.update(organization)
        .set({ logoAssetKey: objectKey, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(organization.id, context.organizationId)),
      auditInsert(
        runtime.ORM,
        context,
        current.logoAssetKey ? "organization.logo_replaced" : "organization.logo_added",
        "organization",
        context.organizationId,
      ),
    ]);
  } catch (error) {
    await runtime.FILES.delete(objectKey);
    throw error;
  }
  if (current.logoAssetKey) await runtime.FILES.delete(current.logoAssetKey);
  return Response.json({ ok: true, logoUrl: `/api/organization/logo?v=${Date.now()}` });
}

async function getOrganizationAudit(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "audit.read")) return forbidden();
  const url = new URL(request.url);
  const parsed = auditQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    action: url.searchParams.get("action") ?? "all",
    page: url.searchParams.get("page") ?? "1",
    pageSize: url.searchParams.get("pageSize") ?? "25",
  });
  if (!parsed.success) {
    return Response.json({ error: "Check the audit filters." }, { status: 400 });
  }

  const runtime = getRuntimeEnv();
  const { q, action, page, pageSize } = parsed.data;
  const conditions = [eq(auditEvent.organizationId, context.organizationId)];
  if (action !== "all") conditions.push(eq(auditEvent.action, action));
  if (q) {
    const search = `%${escapeLikePattern(q.toLowerCase())}%`;
    conditions.push(
      or(
        sql`lower(${auditEvent.action}) like ${search} escape '\\'`,
        sql`lower(${auditEvent.entityType}) like ${search} escape '\\'`,
        sql`lower(coalesce(${auditEvent.entityId}, '')) like ${search} escape '\\'`,
        sql`lower(coalesce(${user.name}, '')) like ${search} escape '\\'`,
      )!,
    );
  }
  const where = and(...conditions);
  const [countRows, events, actions] = await runtime.ORM.batch([
    runtime.ORM.select({ total: count() })
      .from(auditEvent)
      .leftJoin(user, eq(user.id, auditEvent.actorUserId))
      .where(where),
    runtime.ORM.select({
      id: auditEvent.id,
      action: auditEvent.action,
      entityType: auditEvent.entityType,
      entityId: auditEvent.entityId,
      metadataJson: auditEvent.metadataJson,
      occurredAt: auditEvent.occurredAt,
      actorName: user.name,
      actorEmail: user.email,
    })
      .from(auditEvent)
      .leftJoin(user, eq(user.id, auditEvent.actorUserId))
      .where(where)
      .orderBy(desc(auditEvent.occurredAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    runtime.ORM.selectDistinct({ action: auditEvent.action })
      .from(auditEvent)
      .where(eq(auditEvent.organizationId, context.organizationId))
      .orderBy(asc(auditEvent.action)),
  ]);
  const countRow = countRows[0];
  const total = Number(countRow?.total ?? 0);
  return Response.json({
    events,
    actions: actions.map((item) => item.action),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

async function handleOrganizationSessions(request: Request): Promise<Response> {
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "organization.settings.read")) return forbidden();
  const runtime = getRuntimeEnv();

  if (request.method === "GET") {
    const sessions = await runtime.ORM.select({
      id: academicSession.id,
      name: academicSession.name,
      startsOn: academicSession.startsOn,
      endsOn: academicSession.endsOn,
      isActive: academicSession.isActive,
    })
      .from(academicSession)
      .where(eq(academicSession.organizationId, context.organizationId))
      .orderBy(desc(academicSession.startsOn));
    return Response.json({
      sessions: sessions.map((session) => ({ ...session, isActive: Boolean(session.isActive) })),
      capabilities: {
        manage: hasPermission(context, "organization.settings.manage"),
      },
    });
  }

  if (request.method !== "POST") return methodNotAllowed("GET, POST");
  if (!isSameOrigin(request)) return forbidden();
  if (!hasPermission(context, "organization.settings.manage")) return forbidden();
  const parsed = academicSessionSettingsSchema.safeParse(await readJson(request));
  if (!parsed.success || parsed.data.startsOn >= parsed.data.endsOn) {
    return Response.json(
      { error: "Enter a name and an end date after the start date." },
      { status: 400 },
    );
  }
  const duplicate = await runtime.ORM.select({ id: academicSession.id })
    .from(academicSession)
    .where(
      and(
        eq(academicSession.organizationId, context.organizationId),
        eq(sql<string>`lower(${academicSession.name})`, parsed.data.name.toLowerCase()),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (duplicate) {
    return Response.json(
      { error: "An academic session with this name already exists." },
      { status: 409 },
    );
  }
  const id = crypto.randomUUID();
  await runtime.ORM.batch([
    runtime.ORM.insert(academicSession).values({
      id,
      organizationId: context.organizationId,
      name: parsed.data.name,
      startsOn: parsed.data.startsOn,
      endsOn: parsed.data.endsOn,
      isActive: parsed.data.isActive ? 1 : 0,
      sourceSystem: "tsewa",
      sourceTable: "academic_session",
      sourceId: id,
    }),
    auditInsert(runtime.ORM, context, "academic_session.created", "academic_session", id, {
      name: parsed.data.name,
      startsOn: parsed.data.startsOn,
      endsOn: parsed.data.endsOn,
      isActive: parsed.data.isActive,
    }),
  ]);
  return Response.json({ id }, { status: 201 });
}

async function updateOrganizationSession(request: Request, sessionId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "organization.settings.manage")) return forbidden();
  const parsedId = z.uuid().safeParse(sessionId);
  const parsed = academicSessionSettingsSchema.safeParse(await readJson(request));
  if (!parsedId.success || !parsed.success || parsed.data.startsOn >= parsed.data.endsOn) {
    return Response.json({ error: "Check the academic session details." }, { status: 400 });
  }
  const runtime = getRuntimeEnv();
  const existing = await runtime.ORM.select({ id: academicSession.id })
    .from(academicSession)
    .where(
      and(
        eq(academicSession.id, parsedId.data),
        eq(academicSession.organizationId, context.organizationId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0]);
  if (!existing) return Response.json({ error: "Academic session not found." }, { status: 404 });
  await runtime.ORM.batch([
    runtime.ORM.update(academicSession)
      .set({
        name: parsed.data.name,
        startsOn: parsed.data.startsOn,
        endsOn: parsed.data.endsOn,
        isActive: parsed.data.isActive ? 1 : 0,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(academicSession.id, parsedId.data),
          eq(academicSession.organizationId, context.organizationId),
        ),
      ),
    auditInsert(
      runtime.ORM,
      context,
      "academic_session.updated",
      "academic_session",
      parsedId.data,
      {
        name: parsed.data.name,
        startsOn: parsed.data.startsOn,
        endsOn: parsed.data.endsOn,
        isActive: parsed.data.isActive,
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
  invitationUrl.pathname = `/invite/${token}`;
  invitationUrl.search = "";

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
  if (!invitation) {
    const code = await getInvitationFailure(getRuntimeEnv().ORM, token);
    const messages = {
      expired: "This invitation has expired.",
      revoked: "This invitation was revoked.",
      used: "This invitation has already been accepted.",
      invalid: "This invitation link is invalid.",
    } as const;
    return Response.json(
      { code, error: messages[code] },
      { status: code === "invalid" ? 404 : 410 },
    );
  }

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
  const invitation = await findInvitation(runtime.ORM, parsed.data.token);
  if (!invitation) {
    const code = await getInvitationFailure(runtime.ORM, parsed.data.token);
    return Response.json(
      { code, error: "This invitation is no longer available." },
      { status: 410 },
    );
  }
  if (invitation.email !== session.user.email.trim().toLowerCase()) {
    return Response.json(
      {
        code: "wrong_account",
        error: `Sign in as ${invitation.email} to accept this invitation.`,
      },
      { status: 409 },
    );
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
  const deleteRoles = runtime.ORM.delete(accessGroupRole).where(
    eq(accessGroupRole.groupId, groupId),
  );
  const touchGroup = runtime.ORM.update(accessGroup)
    .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(
      and(eq(accessGroup.id, groupId), eq(accessGroup.organizationId, context.organizationId)),
    );
  const audit = auditInsert(
    runtime.ORM,
    context,
    "access_group.roles_changed",
    "access_group",
    groupId,
    { group, roleKeys: roleKeys.join(",") },
  );
  if (roleKeys.length) {
    await runtime.ORM.batch([
      deleteRoles,
      runtime.ORM.insert(accessGroupRole).values(
        roleKeys.map((roleKey) => ({
          groupId,
          roleId: accessRoleId(context.organizationId, roleKey),
        })),
      ),
      touchGroup,
      audit,
    ]);
  } else {
    await runtime.ORM.batch([deleteRoles, touchGroup, audit]);
  }
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
  invitationUrl.pathname = `/invite/${token}`;
  invitationUrl.search = "";
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
    activeSessionId: sql<string | null>`CASE
      WHEN ${userPreference.activeOrganizationId} = ${organizationMember.organizationId}
      THEN ${userPreference.activeAcademicSessionId}
      ELSE NULL
    END`,
    permissionKeys: sql<
      string | null
    >`group_concat(distinct ${accessRolePermission.permissionKey})`,
  })
    .from(organizationMember)
    .leftJoin(accessGroup, eq(accessGroup.id, organizationMember.groupId))
    .leftJoin(userPreference, eq(userPreference.userId, organizationMember.userId))
    .leftJoin(accessGroupRole, eq(accessGroupRole.groupId, organizationMember.groupId))
    .leftJoin(accessRolePermission, eq(accessRolePermission.roleId, accessGroupRole.roleId))
    .where(eq(organizationMember.userId, session.user.id))
    .groupBy(
      organizationMember.id,
      organizationMember.organizationId,
      organizationMember.role,
      organizationMember.createdAt,
      accessGroup.key,
      userPreference.activeOrganizationId,
      userPreference.activeAcademicSessionId,
    )
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
      : ((membership.permissionKeys?.split(",").filter(Boolean) ?? []) as PermissionKey[]);

  return {
    memberId: membership.memberId,
    organizationId: membership.organizationId,
    group: membership.group,
    activeSessionId: membership.activeSessionId,
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

async function getInvitationFailure(
  database: Database,
  token: string,
): Promise<"expired" | "revoked" | "used" | "invalid"> {
  if (token.length < 32 || token.length > 256) return "invalid";
  const tokenHash = await hashInvitationToken(token);
  const row = await database
    .select({
      acceptedAt: organizationInvitation.acceptedAt,
      revokedAt: organizationInvitation.revokedAt,
      expiresAt: organizationInvitation.expiresAt,
    })
    .from(organizationInvitation)
    .where(eq(organizationInvitation.tokenHash, tokenHash))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!row) return "invalid";
  if (row.revokedAt) return "revoked";
  if (row.acceptedAt) return "used";
  if (new Date(row.expiresAt).getTime() <= Date.now()) return "expired";
  return "invalid";
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

async function getStaffDirectory(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "staff.read")) return forbidden();

  const url = new URL(request.url);
  const parsed = staffQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "Invalid staff filters." }, { status: 400 });
  }

  const result = await findStaffDirectory(getRuntimeEnv().ORM, context.organizationId, parsed.data);
  return Response.json({
    ...result,
    capabilities: { manage: hasPermission(context, "staff.manage") },
  });
}

async function updateStaffProfile(request: Request, personId: string): Promise<Response> {
  if (request.method !== "PATCH") return methodNotAllowed("PATCH");
  if (!isSameOrigin(request)) return forbidden();
  const context = await getMembershipContext(request);
  if (!context) return unauthorized();
  if (!hasPermission(context, "staff.manage")) return forbidden();

  const parsed = staffProfileSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json(
      { error: "Review the employment and contact details and try again." },
      { status: 400 },
    );
  }

  const database = getRuntimeEnv().ORM;
  const existing = await database
    .select({ id: staffProfile.id })
    .from(staffProfile)
    .innerJoin(person, eq(person.id, staffProfile.personId))
    .where(
      and(
        eq(staffProfile.personId, personId),
        eq(staffProfile.organizationId, context.organizationId),
        eq(person.organizationId, context.organizationId),
        eq(person.kind, "staff"),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!existing) return Response.json({ error: "Staff profile not found." }, { status: 404 });

  const [departments, designations, categories] = await database.batch([
    database
      .select({ id: staffDepartment.id })
      .from(staffDepartment)
      .where(
        and(
          eq(staffDepartment.organizationId, context.organizationId),
          eq(staffDepartment.id, parsed.data.departmentId ?? ""),
          eq(staffDepartment.isActive, 1),
        ),
      )
      .limit(1),
    database
      .select({ id: staffDesignation.id, departmentId: staffDesignation.departmentId })
      .from(staffDesignation)
      .where(
        and(
          eq(staffDesignation.organizationId, context.organizationId),
          eq(staffDesignation.id, parsed.data.designationId ?? ""),
          eq(staffDesignation.isActive, 1),
        ),
      )
      .limit(1),
    database
      .select({ id: staffCategory.id })
      .from(staffCategory)
      .where(
        and(
          eq(staffCategory.organizationId, context.organizationId),
          eq(staffCategory.id, parsed.data.categoryId ?? ""),
          eq(staffCategory.isActive, 1),
        ),
      )
      .limit(1),
  ]);

  if (parsed.data.departmentId && !departments[0]) {
    return Response.json({ error: "Select a valid department." }, { status: 400 });
  }
  if (parsed.data.designationId && !designations[0]) {
    return Response.json({ error: "Select a valid designation." }, { status: 400 });
  }
  if (parsed.data.categoryId && !categories[0]) {
    return Response.json({ error: "Select a valid staff category." }, { status: 400 });
  }
  if (
    parsed.data.departmentId &&
    designations[0]?.departmentId &&
    designations[0].departmentId !== parsed.data.departmentId
  ) {
    return Response.json(
      { error: "The designation does not belong to the selected department." },
      { status: 400 },
    );
  }

  const value = parsed.data;
  await database.batch([
    database
      .update(person)
      .set({
        status: value.status,
        admittedOrJoinedOn: value.joinedOn,
        campusOrLocation: value.location,
        registrationCertificateNumber: value.registrationCertificateNumber,
        identityCertificateNumber: value.identityCardNumber,
        updatedByUserId: context.userId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(and(eq(person.id, personId), eq(person.organizationId, context.organizationId))),
    database
      .update(staffProfile)
      .set({
        departmentId: value.departmentId,
        designationId: value.designationId,
        categoryId: value.categoryId,
        permanentOn: value.permanentOn,
        phone: value.phone,
        email: value.email,
        address: value.address,
        maritalStatus: value.maritalStatus,
        spouseName: value.spouseName,
        settlementName: value.settlementName,
        allocatedPlace: value.allocatedPlace,
        registrationCertificateNumber: value.registrationCertificateNumber,
        panNumber: value.panNumber,
        quarterNumber: value.quarterNumber,
        nominee: value.nominee,
        birthPlace: value.birthPlace,
        city: value.city,
        region: value.region,
        country: value.country,
        identityCardNumber: value.identityCardNumber,
        greenBookNumber: value.greenBookNumber,
        remarks: value.remarks,
        updatedByUserId: context.userId,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(staffProfile.personId, personId),
          eq(staffProfile.organizationId, context.organizationId),
        ),
      ),
    auditInsert(database, context, "staff.profile_updated", "staff_profile", existing.id, {
      personId,
      status: value.status,
      departmentId: value.departmentId,
      designationId: value.designationId,
    }),
  ]);

  return Response.json({ ok: true });
}

function auditInsert(
  database: Database,
  context: MembershipContext,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, string | number | boolean | null>,
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

function isTsewaSource(value: string | null | undefined): boolean {
  return value?.toLowerCase() === "tsewa";
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
