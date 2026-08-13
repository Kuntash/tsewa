import { relations } from "drizzle-orm/relations";
import {
  user,
  session,
  account,
  accessGroup,
  organizationMember,
  organization,
  academicSession,
  userPreference,
  auditEvent,
  organizationInvitation,
  personImportBatch,
  person,
  personImportIssue,
  personImportIssueSummary,
  personPlacementImportBatch,
  personPlacement,
  personAcademicImportBatch,
  personAcademicRecord,
  personFamilyImportBatch,
  personFamilyProfile,
  personRelationship,
  personFileImportBatch,
  personFile,
  schoolOperationsImportBatch,
  schoolMaster,
  academicClassMaster,
  houseMaster,
  schoolHouseMaster,
  studentEnrollmentImportBatch,
  schoolClassOffering,
  studentEnrollment,
  historicalResultsImportBatch,
  academicSubject,
  academicTerm,
  academicAssessment,
  markSheet,
  studentMark,
  studentEnrollmentChange,
  healthHistoryImportBatch,
  healthVisit,
  healthDiagnosis,
  healthTbCase,
  healthTbDetail,
  healthMedicalAdvance,
  healthMedicalAdvanceDetail,
  healthMedicalSettlement,
  accessRole,
  accessPermission,
  accessRolePermission,
  accessGroupRole,
} from "./schema";

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  organizationMembers: many(organizationMember),
  userPreferences: many(userPreference),
  auditEvents: many(auditEvent),
  organizationInvitations_acceptedByUserId: many(organizationInvitation, {
    relationName: "organizationInvitation_acceptedByUserId_user_id",
  }),
  organizationInvitations_invitedByUserId: many(organizationInvitation, {
    relationName: "organizationInvitation_invitedByUserId_user_id",
  }),
  personImportBatches: many(personImportBatch),
  people_updatedByUserId: many(person, {
    relationName: "person_updatedByUserId_user_id",
  }),
  people_createdByUserId: many(person, {
    relationName: "person_createdByUserId_user_id",
  }),
  personPlacements_updatedByUserId: many(personPlacement, {
    relationName: "personPlacement_updatedByUserId_user_id",
  }),
  personPlacements_createdByUserId: many(personPlacement, {
    relationName: "personPlacement_createdByUserId_user_id",
  }),
  personFamilyProfiles: many(personFamilyProfile),
  personRelationships: many(personRelationship),
  personFiles_updatedByUserId: many(personFile, {
    relationName: "personFile_updatedByUserId_user_id",
  }),
  personFiles_createdByUserId: many(personFile, {
    relationName: "personFile_createdByUserId_user_id",
  }),
  studentEnrollmentChanges: many(studentEnrollmentChange),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const organizationMemberRelations = relations(organizationMember, ({ one }) => ({
  accessGroup: one(accessGroup, {
    fields: [organizationMember.groupId],
    references: [accessGroup.id],
  }),
  user: one(user, {
    fields: [organizationMember.userId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [organizationMember.organizationId],
    references: [organization.id],
  }),
}));

export const accessGroupRelations = relations(accessGroup, ({ one, many }) => ({
  organizationMembers: many(organizationMember),
  organizationInvitations: many(organizationInvitation),
  organization: one(organization, {
    fields: [accessGroup.organizationId],
    references: [organization.id],
  }),
  accessGroupRoles: many(accessGroupRole),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  organizationMembers: many(organizationMember),
  academicSessions: many(academicSession),
  userPreferences: many(userPreference),
  auditEvents: many(auditEvent),
  organizationInvitations: many(organizationInvitation),
  personImportBatches: many(personImportBatch),
  people: many(person),
  personPlacementImportBatches: many(personPlacementImportBatch),
  personPlacements: many(personPlacement),
  personAcademicImportBatches: many(personAcademicImportBatch),
  personAcademicRecords: many(personAcademicRecord),
  personFamilyImportBatches: many(personFamilyImportBatch),
  personFamilyProfiles: many(personFamilyProfile),
  personRelationships: many(personRelationship),
  personFileImportBatches: many(personFileImportBatch),
  personFiles: many(personFile),
  schoolOperationsImportBatches: many(schoolOperationsImportBatch),
  schoolMasters: many(schoolMaster),
  academicClassMasters: many(academicClassMaster),
  houseMasters: many(houseMaster),
  schoolHouseMasters: many(schoolHouseMaster),
  studentEnrollmentImportBatches: many(studentEnrollmentImportBatch),
  schoolClassOfferings: many(schoolClassOffering),
  studentEnrollments: many(studentEnrollment),
  historicalResultsImportBatches: many(historicalResultsImportBatch),
  academicSubjects: many(academicSubject),
  academicTerms: many(academicTerm),
  academicAssessments: many(academicAssessment),
  markSheets: many(markSheet),
  studentMarks: many(studentMark),
  studentEnrollmentChanges: many(studentEnrollmentChange),
  healthHistoryImportBatches: many(healthHistoryImportBatch),
  healthVisits: many(healthVisit),
  healthDiagnoses: many(healthDiagnosis),
  healthTbCases: many(healthTbCase),
  healthTbDetails: many(healthTbDetail),
  healthMedicalAdvances: many(healthMedicalAdvance),
  healthMedicalAdvanceDetails: many(healthMedicalAdvanceDetail),
  healthMedicalSettlements: many(healthMedicalSettlement),
  accessRoles: many(accessRole),
  accessGroups: many(accessGroup),
}));

export const academicSessionRelations = relations(academicSession, ({ one, many }) => ({
  organization: one(organization, {
    fields: [academicSession.organizationId],
    references: [organization.id],
  }),
  userPreferences: many(userPreference),
  schoolClassOfferings: many(schoolClassOffering),
  studentEnrollments: many(studentEnrollment),
  academicSubjects: many(academicSubject),
  academicAssessments: many(academicAssessment),
  markSheets: many(markSheet),
  studentEnrollmentChanges: many(studentEnrollmentChange),
}));

export const userPreferenceRelations = relations(userPreference, ({ one }) => ({
  academicSession: one(academicSession, {
    fields: [userPreference.activeAcademicSessionId],
    references: [academicSession.id],
  }),
  organization: one(organization, {
    fields: [userPreference.activeOrganizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [userPreference.userId],
    references: [user.id],
  }),
}));

export const auditEventRelations = relations(auditEvent, ({ one }) => ({
  user: one(user, {
    fields: [auditEvent.actorUserId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [auditEvent.organizationId],
    references: [organization.id],
  }),
}));

export const organizationInvitationRelations = relations(organizationInvitation, ({ one }) => ({
  accessGroup: one(accessGroup, {
    fields: [organizationInvitation.groupId],
    references: [accessGroup.id],
  }),
  user_acceptedByUserId: one(user, {
    fields: [organizationInvitation.acceptedByUserId],
    references: [user.id],
    relationName: "organizationInvitation_acceptedByUserId_user_id",
  }),
  user_invitedByUserId: one(user, {
    fields: [organizationInvitation.invitedByUserId],
    references: [user.id],
    relationName: "organizationInvitation_invitedByUserId_user_id",
  }),
  organization: one(organization, {
    fields: [organizationInvitation.organizationId],
    references: [organization.id],
  }),
}));

export const personImportBatchRelations = relations(personImportBatch, ({ one, many }) => ({
  user: one(user, {
    fields: [personImportBatch.createdByUserId],
    references: [user.id],
  }),
  organization: one(organization, {
    fields: [personImportBatch.organizationId],
    references: [organization.id],
  }),
  people: many(person),
  personImportIssues: many(personImportIssue),
  personImportIssueSummaries: many(personImportIssueSummary),
}));

export const personRelations = relations(person, ({ one, many }) => ({
  user_updatedByUserId: one(user, {
    fields: [person.updatedByUserId],
    references: [user.id],
    relationName: "person_updatedByUserId_user_id",
  }),
  user_createdByUserId: one(user, {
    fields: [person.createdByUserId],
    references: [user.id],
    relationName: "person_createdByUserId_user_id",
  }),
  personImportBatch: one(personImportBatch, {
    fields: [person.importBatchId],
    references: [personImportBatch.id],
  }),
  organization: one(organization, {
    fields: [person.organizationId],
    references: [organization.id],
  }),
  personPlacements: many(personPlacement),
  personAcademicRecords: many(personAcademicRecord),
  personFamilyProfiles: many(personFamilyProfile),
  personRelationships_relatedPersonId: many(personRelationship, {
    relationName: "personRelationship_relatedPersonId_person_id",
  }),
  personRelationships_personId: many(personRelationship, {
    relationName: "personRelationship_personId_person_id",
  }),
  personFiles: many(personFile),
  studentEnrollments: many(studentEnrollment),
  studentMarks: many(studentMark),
  studentEnrollmentChanges: many(studentEnrollmentChange),
}));

export const personImportIssueRelations = relations(personImportIssue, ({ one }) => ({
  personImportBatch: one(personImportBatch, {
    fields: [personImportIssue.importBatchId],
    references: [personImportBatch.id],
  }),
}));

export const personImportIssueSummaryRelations = relations(personImportIssueSummary, ({ one }) => ({
  personImportBatch: one(personImportBatch, {
    fields: [personImportIssueSummary.importBatchId],
    references: [personImportBatch.id],
  }),
}));

export const personPlacementImportBatchRelations = relations(
  personPlacementImportBatch,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [personPlacementImportBatch.organizationId],
      references: [organization.id],
    }),
    personPlacements: many(personPlacement),
  }),
);

export const personPlacementRelations = relations(personPlacement, ({ one }) => ({
  user_updatedByUserId: one(user, {
    fields: [personPlacement.updatedByUserId],
    references: [user.id],
    relationName: "personPlacement_updatedByUserId_user_id",
  }),
  user_createdByUserId: one(user, {
    fields: [personPlacement.createdByUserId],
    references: [user.id],
    relationName: "personPlacement_createdByUserId_user_id",
  }),
  personPlacementImportBatch: one(personPlacementImportBatch, {
    fields: [personPlacement.importBatchId],
    references: [personPlacementImportBatch.id],
  }),
  person: one(person, {
    fields: [personPlacement.personId],
    references: [person.id],
  }),
  organization: one(organization, {
    fields: [personPlacement.organizationId],
    references: [organization.id],
  }),
}));

export const personAcademicImportBatchRelations = relations(
  personAcademicImportBatch,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [personAcademicImportBatch.organizationId],
      references: [organization.id],
    }),
    personAcademicRecords: many(personAcademicRecord),
  }),
);

export const personAcademicRecordRelations = relations(personAcademicRecord, ({ one, many }) => ({
  personAcademicImportBatch: one(personAcademicImportBatch, {
    fields: [personAcademicRecord.importBatchId],
    references: [personAcademicImportBatch.id],
  }),
  person: one(person, {
    fields: [personAcademicRecord.personId],
    references: [person.id],
  }),
  organization: one(organization, {
    fields: [personAcademicRecord.organizationId],
    references: [organization.id],
  }),
  studentEnrollments: many(studentEnrollment),
}));

export const personFamilyImportBatchRelations = relations(
  personFamilyImportBatch,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [personFamilyImportBatch.organizationId],
      references: [organization.id],
    }),
    personFamilyProfiles: many(personFamilyProfile),
    personRelationships: many(personRelationship),
  }),
);

export const personFamilyProfileRelations = relations(personFamilyProfile, ({ one }) => ({
  user: one(user, {
    fields: [personFamilyProfile.updatedByUserId],
    references: [user.id],
  }),
  personFamilyImportBatch: one(personFamilyImportBatch, {
    fields: [personFamilyProfile.importBatchId],
    references: [personFamilyImportBatch.id],
  }),
  person: one(person, {
    fields: [personFamilyProfile.personId],
    references: [person.id],
  }),
  organization: one(organization, {
    fields: [personFamilyProfile.organizationId],
    references: [organization.id],
  }),
}));

export const personRelationshipRelations = relations(personRelationship, ({ one }) => ({
  user: one(user, {
    fields: [personRelationship.updatedByUserId],
    references: [user.id],
  }),
  personFamilyImportBatch: one(personFamilyImportBatch, {
    fields: [personRelationship.importBatchId],
    references: [personFamilyImportBatch.id],
  }),
  person_relatedPersonId: one(person, {
    fields: [personRelationship.relatedPersonId],
    references: [person.id],
    relationName: "personRelationship_relatedPersonId_person_id",
  }),
  person_personId: one(person, {
    fields: [personRelationship.personId],
    references: [person.id],
    relationName: "personRelationship_personId_person_id",
  }),
  organization: one(organization, {
    fields: [personRelationship.organizationId],
    references: [organization.id],
  }),
}));

export const personFileImportBatchRelations = relations(personFileImportBatch, ({ one, many }) => ({
  organization: one(organization, {
    fields: [personFileImportBatch.organizationId],
    references: [organization.id],
  }),
  personFiles: many(personFile),
}));

export const personFileRelations = relations(personFile, ({ one, many }) => ({
  personFile: one(personFile, {
    fields: [personFile.replacesFileId],
    references: [personFile.id],
    relationName: "personFile_replacesFileId_personFile_id",
  }),
  personFiles: many(personFile, {
    relationName: "personFile_replacesFileId_personFile_id",
  }),
  user_updatedByUserId: one(user, {
    fields: [personFile.updatedByUserId],
    references: [user.id],
    relationName: "personFile_updatedByUserId_user_id",
  }),
  user_createdByUserId: one(user, {
    fields: [personFile.createdByUserId],
    references: [user.id],
    relationName: "personFile_createdByUserId_user_id",
  }),
  personFileImportBatch: one(personFileImportBatch, {
    fields: [personFile.importBatchId],
    references: [personFileImportBatch.id],
  }),
  person: one(person, {
    fields: [personFile.personId],
    references: [person.id],
  }),
  organization: one(organization, {
    fields: [personFile.organizationId],
    references: [organization.id],
  }),
}));

export const schoolOperationsImportBatchRelations = relations(
  schoolOperationsImportBatch,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [schoolOperationsImportBatch.organizationId],
      references: [organization.id],
    }),
    schoolMasters: many(schoolMaster),
    academicClassMasters: many(academicClassMaster),
    houseMasters: many(houseMaster),
    schoolHouseMasters: many(schoolHouseMaster),
  }),
);

export const schoolMasterRelations = relations(schoolMaster, ({ one, many }) => ({
  schoolOperationsImportBatch: one(schoolOperationsImportBatch, {
    fields: [schoolMaster.importBatchId],
    references: [schoolOperationsImportBatch.id],
  }),
  organization: one(organization, {
    fields: [schoolMaster.organizationId],
    references: [organization.id],
  }),
  schoolHouseMasters: many(schoolHouseMaster),
  schoolClassOfferings: many(schoolClassOffering),
  studentEnrollments: many(studentEnrollment),
  markSheets: many(markSheet),
  studentEnrollmentChanges_toSchoolId: many(studentEnrollmentChange, {
    relationName: "studentEnrollmentChange_toSchoolId_schoolMaster_id",
  }),
  studentEnrollmentChanges_fromSchoolId: many(studentEnrollmentChange, {
    relationName: "studentEnrollmentChange_fromSchoolId_schoolMaster_id",
  }),
}));

export const academicClassMasterRelations = relations(academicClassMaster, ({ one, many }) => ({
  schoolOperationsImportBatch: one(schoolOperationsImportBatch, {
    fields: [academicClassMaster.importBatchId],
    references: [schoolOperationsImportBatch.id],
  }),
  organization: one(organization, {
    fields: [academicClassMaster.organizationId],
    references: [organization.id],
  }),
  schoolClassOfferings: many(schoolClassOffering),
  studentEnrollments: many(studentEnrollment),
  markSheets: many(markSheet),
  studentEnrollmentChanges_toAcademicClassId: many(studentEnrollmentChange, {
    relationName: "studentEnrollmentChange_toAcademicClassId_academicClassMaster_id",
  }),
  studentEnrollmentChanges_fromAcademicClassId: many(studentEnrollmentChange, {
    relationName: "studentEnrollmentChange_fromAcademicClassId_academicClassMaster_id",
  }),
}));

export const houseMasterRelations = relations(houseMaster, ({ one, many }) => ({
  schoolOperationsImportBatch: one(schoolOperationsImportBatch, {
    fields: [houseMaster.importBatchId],
    references: [schoolOperationsImportBatch.id],
  }),
  organization: one(organization, {
    fields: [houseMaster.organizationId],
    references: [organization.id],
  }),
  schoolHouseMasters: many(schoolHouseMaster),
  studentEnrollments: many(studentEnrollment),
  studentEnrollmentChanges_toHouseId: many(studentEnrollmentChange, {
    relationName: "studentEnrollmentChange_toHouseId_houseMaster_id",
  }),
  studentEnrollmentChanges_fromHouseId: many(studentEnrollmentChange, {
    relationName: "studentEnrollmentChange_fromHouseId_houseMaster_id",
  }),
}));

export const schoolHouseMasterRelations = relations(schoolHouseMaster, ({ one }) => ({
  schoolOperationsImportBatch: one(schoolOperationsImportBatch, {
    fields: [schoolHouseMaster.importBatchId],
    references: [schoolOperationsImportBatch.id],
  }),
  houseMaster: one(houseMaster, {
    fields: [schoolHouseMaster.houseId],
    references: [houseMaster.id],
  }),
  schoolMaster: one(schoolMaster, {
    fields: [schoolHouseMaster.schoolId],
    references: [schoolMaster.id],
  }),
  organization: one(organization, {
    fields: [schoolHouseMaster.organizationId],
    references: [organization.id],
  }),
}));

export const studentEnrollmentImportBatchRelations = relations(
  studentEnrollmentImportBatch,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [studentEnrollmentImportBatch.organizationId],
      references: [organization.id],
    }),
    schoolClassOfferings: many(schoolClassOffering),
    studentEnrollments: many(studentEnrollment),
  }),
);

export const schoolClassOfferingRelations = relations(schoolClassOffering, ({ one, many }) => ({
  studentEnrollmentImportBatch: one(studentEnrollmentImportBatch, {
    fields: [schoolClassOffering.importBatchId],
    references: [studentEnrollmentImportBatch.id],
  }),
  academicClassMaster: one(academicClassMaster, {
    fields: [schoolClassOffering.academicClassId],
    references: [academicClassMaster.id],
  }),
  schoolMaster: one(schoolMaster, {
    fields: [schoolClassOffering.schoolId],
    references: [schoolMaster.id],
  }),
  academicSession: one(academicSession, {
    fields: [schoolClassOffering.academicSessionId],
    references: [academicSession.id],
  }),
  organization: one(organization, {
    fields: [schoolClassOffering.organizationId],
    references: [organization.id],
  }),
  studentEnrollments: many(studentEnrollment),
}));

export const studentEnrollmentRelations = relations(studentEnrollment, ({ one, many }) => ({
  studentEnrollmentImportBatch: one(studentEnrollmentImportBatch, {
    fields: [studentEnrollment.importBatchId],
    references: [studentEnrollmentImportBatch.id],
  }),
  personAcademicRecord: one(personAcademicRecord, {
    fields: [studentEnrollment.sourceAcademicRecordId],
    references: [personAcademicRecord.id],
  }),
  schoolClassOffering: one(schoolClassOffering, {
    fields: [studentEnrollment.schoolClassOfferingId],
    references: [schoolClassOffering.id],
  }),
  houseMaster: one(houseMaster, {
    fields: [studentEnrollment.houseId],
    references: [houseMaster.id],
  }),
  academicClassMaster: one(academicClassMaster, {
    fields: [studentEnrollment.academicClassId],
    references: [academicClassMaster.id],
  }),
  schoolMaster: one(schoolMaster, {
    fields: [studentEnrollment.schoolId],
    references: [schoolMaster.id],
  }),
  academicSession: one(academicSession, {
    fields: [studentEnrollment.academicSessionId],
    references: [academicSession.id],
  }),
  person: one(person, {
    fields: [studentEnrollment.personId],
    references: [person.id],
  }),
  organization: one(organization, {
    fields: [studentEnrollment.organizationId],
    references: [organization.id],
  }),
  studentEnrollmentChanges: many(studentEnrollmentChange),
}));

export const historicalResultsImportBatchRelations = relations(
  historicalResultsImportBatch,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [historicalResultsImportBatch.organizationId],
      references: [organization.id],
    }),
    academicSubjects: many(academicSubject),
    academicTerms: many(academicTerm),
    academicAssessments: many(academicAssessment),
    markSheets: many(markSheet),
    studentMarks: many(studentMark),
  }),
);

export const academicSubjectRelations = relations(academicSubject, ({ one, many }) => ({
  historicalResultsImportBatch: one(historicalResultsImportBatch, {
    fields: [academicSubject.importBatchId],
    references: [historicalResultsImportBatch.id],
  }),
  academicSession: one(academicSession, {
    fields: [academicSubject.academicSessionId],
    references: [academicSession.id],
  }),
  organization: one(organization, {
    fields: [academicSubject.organizationId],
    references: [organization.id],
  }),
  markSheets: many(markSheet),
}));

export const academicTermRelations = relations(academicTerm, ({ one, many }) => ({
  historicalResultsImportBatch: one(historicalResultsImportBatch, {
    fields: [academicTerm.importBatchId],
    references: [historicalResultsImportBatch.id],
  }),
  organization: one(organization, {
    fields: [academicTerm.organizationId],
    references: [organization.id],
  }),
  academicAssessments: many(academicAssessment),
  markSheets: many(markSheet),
}));

export const academicAssessmentRelations = relations(academicAssessment, ({ one, many }) => ({
  historicalResultsImportBatch: one(historicalResultsImportBatch, {
    fields: [academicAssessment.importBatchId],
    references: [historicalResultsImportBatch.id],
  }),
  academicTerm: one(academicTerm, {
    fields: [academicAssessment.termId],
    references: [academicTerm.id],
  }),
  academicSession: one(academicSession, {
    fields: [academicAssessment.academicSessionId],
    references: [academicSession.id],
  }),
  organization: one(organization, {
    fields: [academicAssessment.organizationId],
    references: [organization.id],
  }),
  studentMarks: many(studentMark),
}));

export const markSheetRelations = relations(markSheet, ({ one, many }) => ({
  historicalResultsImportBatch: one(historicalResultsImportBatch, {
    fields: [markSheet.importBatchId],
    references: [historicalResultsImportBatch.id],
  }),
  academicTerm: one(academicTerm, {
    fields: [markSheet.termId],
    references: [academicTerm.id],
  }),
  academicSubject: one(academicSubject, {
    fields: [markSheet.subjectId],
    references: [academicSubject.id],
  }),
  academicClassMaster: one(academicClassMaster, {
    fields: [markSheet.academicClassId],
    references: [academicClassMaster.id],
  }),
  schoolMaster: one(schoolMaster, {
    fields: [markSheet.schoolId],
    references: [schoolMaster.id],
  }),
  academicSession: one(academicSession, {
    fields: [markSheet.academicSessionId],
    references: [academicSession.id],
  }),
  organization: one(organization, {
    fields: [markSheet.organizationId],
    references: [organization.id],
  }),
  studentMarks: many(studentMark),
}));

export const studentMarkRelations = relations(studentMark, ({ one }) => ({
  historicalResultsImportBatch: one(historicalResultsImportBatch, {
    fields: [studentMark.importBatchId],
    references: [historicalResultsImportBatch.id],
  }),
  academicAssessment: one(academicAssessment, {
    fields: [studentMark.assessmentId],
    references: [academicAssessment.id],
  }),
  person: one(person, {
    fields: [studentMark.personId],
    references: [person.id],
  }),
  markSheet: one(markSheet, {
    fields: [studentMark.markSheetId],
    references: [markSheet.id],
  }),
  organization: one(organization, {
    fields: [studentMark.organizationId],
    references: [organization.id],
  }),
}));

export const studentEnrollmentChangeRelations = relations(studentEnrollmentChange, ({ one }) => ({
  user: one(user, {
    fields: [studentEnrollmentChange.createdByUserId],
    references: [user.id],
  }),
  houseMaster_toHouseId: one(houseMaster, {
    fields: [studentEnrollmentChange.toHouseId],
    references: [houseMaster.id],
    relationName: "studentEnrollmentChange_toHouseId_houseMaster_id",
  }),
  houseMaster_fromHouseId: one(houseMaster, {
    fields: [studentEnrollmentChange.fromHouseId],
    references: [houseMaster.id],
    relationName: "studentEnrollmentChange_fromHouseId_houseMaster_id",
  }),
  academicClassMaster_toAcademicClassId: one(academicClassMaster, {
    fields: [studentEnrollmentChange.toAcademicClassId],
    references: [academicClassMaster.id],
    relationName: "studentEnrollmentChange_toAcademicClassId_academicClassMaster_id",
  }),
  academicClassMaster_fromAcademicClassId: one(academicClassMaster, {
    fields: [studentEnrollmentChange.fromAcademicClassId],
    references: [academicClassMaster.id],
    relationName: "studentEnrollmentChange_fromAcademicClassId_academicClassMaster_id",
  }),
  schoolMaster_toSchoolId: one(schoolMaster, {
    fields: [studentEnrollmentChange.toSchoolId],
    references: [schoolMaster.id],
    relationName: "studentEnrollmentChange_toSchoolId_schoolMaster_id",
  }),
  schoolMaster_fromSchoolId: one(schoolMaster, {
    fields: [studentEnrollmentChange.fromSchoolId],
    references: [schoolMaster.id],
    relationName: "studentEnrollmentChange_fromSchoolId_schoolMaster_id",
  }),
  academicSession: one(academicSession, {
    fields: [studentEnrollmentChange.academicSessionId],
    references: [academicSession.id],
  }),
  person: one(person, {
    fields: [studentEnrollmentChange.personId],
    references: [person.id],
  }),
  studentEnrollment: one(studentEnrollment, {
    fields: [studentEnrollmentChange.enrollmentId],
    references: [studentEnrollment.id],
  }),
  organization: one(organization, {
    fields: [studentEnrollmentChange.organizationId],
    references: [organization.id],
  }),
}));

export const healthHistoryImportBatchRelations = relations(
  healthHistoryImportBatch,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [healthHistoryImportBatch.organizationId],
      references: [organization.id],
    }),
    healthVisits: many(healthVisit),
    healthDiagnoses: many(healthDiagnosis),
    healthTbCases: many(healthTbCase),
    healthTbDetails: many(healthTbDetail),
    healthMedicalAdvances: many(healthMedicalAdvance),
    healthMedicalAdvanceDetails: many(healthMedicalAdvanceDetail),
    healthMedicalSettlements: many(healthMedicalSettlement),
  }),
);

export const healthVisitRelations = relations(healthVisit, ({ one, many }) => ({
  organization: one(organization, {
    fields: [healthVisit.organizationId],
    references: [organization.id],
  }),
  person: one(person, {
    fields: [healthVisit.personId],
    references: [person.id],
  }),
  healthHistoryImportBatch: one(healthHistoryImportBatch, {
    fields: [healthVisit.importBatchId],
    references: [healthHistoryImportBatch.id],
  }),
  healthDiagnoses: many(healthDiagnosis),
}));

export const healthDiagnosisRelations = relations(healthDiagnosis, ({ one }) => ({
  organization: one(organization, {
    fields: [healthDiagnosis.organizationId],
    references: [organization.id],
  }),
  healthVisit: one(healthVisit, {
    fields: [healthDiagnosis.healthVisitId],
    references: [healthVisit.id],
  }),
  healthHistoryImportBatch: one(healthHistoryImportBatch, {
    fields: [healthDiagnosis.importBatchId],
    references: [healthHistoryImportBatch.id],
  }),
}));

export const healthTbCaseRelations = relations(healthTbCase, ({ one, many }) => ({
  organization: one(organization, {
    fields: [healthTbCase.organizationId],
    references: [organization.id],
  }),
  person: one(person, {
    fields: [healthTbCase.personId],
    references: [person.id],
  }),
  healthHistoryImportBatch: one(healthHistoryImportBatch, {
    fields: [healthTbCase.importBatchId],
    references: [healthHistoryImportBatch.id],
  }),
  details: many(healthTbDetail),
}));

export const healthTbDetailRelations = relations(healthTbDetail, ({ one }) => ({
  organization: one(organization, {
    fields: [healthTbDetail.organizationId],
    references: [organization.id],
  }),
  tbCase: one(healthTbCase, {
    fields: [healthTbDetail.tbCaseId],
    references: [healthTbCase.id],
  }),
  healthHistoryImportBatch: one(healthHistoryImportBatch, {
    fields: [healthTbDetail.importBatchId],
    references: [healthHistoryImportBatch.id],
  }),
}));

export const healthMedicalAdvanceRelations = relations(healthMedicalAdvance, ({ one, many }) => ({
  organization: one(organization, {
    fields: [healthMedicalAdvance.organizationId],
    references: [organization.id],
  }),
  healthHistoryImportBatch: one(healthHistoryImportBatch, {
    fields: [healthMedicalAdvance.importBatchId],
    references: [healthHistoryImportBatch.id],
  }),
  details: many(healthMedicalAdvanceDetail),
  settlements: many(healthMedicalSettlement),
}));

export const healthMedicalAdvanceDetailRelations = relations(
  healthMedicalAdvanceDetail,
  ({ one }) => ({
    organization: one(organization, {
      fields: [healthMedicalAdvanceDetail.organizationId],
      references: [organization.id],
    }),
    medicalAdvance: one(healthMedicalAdvance, {
      fields: [healthMedicalAdvanceDetail.medicalAdvanceId],
      references: [healthMedicalAdvance.id],
    }),
    person: one(person, {
      fields: [healthMedicalAdvanceDetail.personId],
      references: [person.id],
    }),
    healthHistoryImportBatch: one(healthHistoryImportBatch, {
      fields: [healthMedicalAdvanceDetail.importBatchId],
      references: [healthHistoryImportBatch.id],
    }),
  }),
);

export const healthMedicalSettlementRelations = relations(healthMedicalSettlement, ({ one }) => ({
  organization: one(organization, {
    fields: [healthMedicalSettlement.organizationId],
    references: [organization.id],
  }),
  medicalAdvance: one(healthMedicalAdvance, {
    fields: [healthMedicalSettlement.medicalAdvanceId],
    references: [healthMedicalAdvance.id],
  }),
  healthHistoryImportBatch: one(healthHistoryImportBatch, {
    fields: [healthMedicalSettlement.importBatchId],
    references: [healthHistoryImportBatch.id],
  }),
}));

export const accessRoleRelations = relations(accessRole, ({ one, many }) => ({
  organization: one(organization, {
    fields: [accessRole.organizationId],
    references: [organization.id],
  }),
  accessRolePermissions: many(accessRolePermission),
  accessGroupRoles: many(accessGroupRole),
}));

export const accessRolePermissionRelations = relations(accessRolePermission, ({ one }) => ({
  accessPermission: one(accessPermission, {
    fields: [accessRolePermission.permissionKey],
    references: [accessPermission.key],
  }),
  accessRole: one(accessRole, {
    fields: [accessRolePermission.roleId],
    references: [accessRole.id],
  }),
}));

export const accessPermissionRelations = relations(accessPermission, ({ many }) => ({
  accessRolePermissions: many(accessRolePermission),
}));

export const accessGroupRoleRelations = relations(accessGroupRole, ({ one }) => ({
  accessRole: one(accessRole, {
    fields: [accessGroupRole.roleId],
    references: [accessRole.id],
  }),
  accessGroup: one(accessGroup, {
    fields: [accessGroupRole.groupId],
    references: [accessGroup.id],
  }),
}));
