import { and, asc, count, eq, or, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  person,
  staffCategory,
  staffDepartment,
  staffDesignation,
  staffProfile,
} from "@/db/schema";

export type StaffDirectoryFilters = {
  q: string;
  status: "all" | "active" | "inactive";
  department: string;
  page: number;
  pageSize: number;
};

export async function findStaffDirectory(
  database: Database,
  organizationId: string,
  filters: StaffDirectoryFilters,
) {
  const conditions = [
    eq(person.organizationId, organizationId),
    eq(person.kind, "staff"),
    eq(staffProfile.organizationId, organizationId),
  ];
  if (filters.status !== "all") conditions.push(eq(person.status, filters.status));
  if (filters.department !== "all") {
    conditions.push(eq(staffProfile.departmentId, filters.department));
  }
  if (filters.q) {
    const search = `%${escapeLikePattern(filters.q.toLowerCase())}%`;
    conditions.push(
      or(
        sql`lower(${person.displayName}) LIKE ${search} ESCAPE '\\'`,
        sql`lower(${person.primaryIdentifier}) LIKE ${search} ESCAPE '\\'`,
        sql`lower(coalesce(${staffProfile.email}, '')) LIKE ${search} ESCAPE '\\'`,
        sql`lower(coalesce(${staffProfile.phone}, '')) LIKE ${search} ESCAPE '\\'`,
      )!,
    );
  }

  const where = and(...conditions);
  const [countRows, staff, summary, departments, designations, categories] = await database.batch([
    database
      .select({ total: count() })
      .from(staffProfile)
      .innerJoin(person, eq(person.id, staffProfile.personId))
      .where(where),
    database
      .select({
        personId: person.id,
        staffNumber: person.primaryIdentifier,
        displayName: person.displayName,
        status: person.status,
        gender: person.gender,
        dateOfBirth: person.dateOfBirth,
        joinedOn: person.admittedOrJoinedOn,
        location: person.campusOrLocation,
        departmentId: staffProfile.departmentId,
        departmentName: staffDepartment.name,
        designationId: staffProfile.designationId,
        designationName: staffDesignation.name,
        categoryId: staffProfile.categoryId,
        categoryName: staffCategory.name,
        permanentOn: staffProfile.permanentOn,
        phone: staffProfile.phone,
        email: staffProfile.email,
        address: staffProfile.address,
        maritalStatus: staffProfile.maritalStatus,
        spouseName: staffProfile.spouseName,
        settlementName: staffProfile.settlementName,
        allocatedPlace: staffProfile.allocatedPlace,
        registrationCertificateNumber: staffProfile.registrationCertificateNumber,
        panNumber: staffProfile.panNumber,
        quarterNumber: staffProfile.quarterNumber,
        nominee: staffProfile.nominee,
        birthPlace: staffProfile.birthPlace,
        city: staffProfile.city,
        region: staffProfile.region,
        country: staffProfile.country,
        identityCardNumber: staffProfile.identityCardNumber,
        greenBookNumber: staffProfile.greenBookNumber,
        withdrawalReason: staffProfile.withdrawalReason,
        withdrawalOn: staffProfile.withdrawalOn,
        remarks: staffProfile.remarks,
        legacyDepartmentId: staffProfile.legacyDepartmentId,
        legacyDesignationId: staffProfile.legacyDesignationId,
      })
      .from(staffProfile)
      .innerJoin(person, eq(person.id, staffProfile.personId))
      .leftJoin(staffDepartment, eq(staffDepartment.id, staffProfile.departmentId))
      .leftJoin(staffDesignation, eq(staffDesignation.id, staffProfile.designationId))
      .leftJoin(staffCategory, eq(staffCategory.id, staffProfile.categoryId))
      .where(where)
      .orderBy(asc(sql`lower(${person.displayName})`), asc(person.primaryIdentifier))
      .limit(filters.pageSize)
      .offset((filters.page - 1) * filters.pageSize),
    database
      .select({ status: person.status, total: count() })
      .from(staffProfile)
      .innerJoin(person, eq(person.id, staffProfile.personId))
      .where(
        and(
          eq(staffProfile.organizationId, organizationId),
          eq(person.organizationId, organizationId),
          eq(person.kind, "staff"),
        ),
      )
      .groupBy(person.status),
    database
      .select({ id: staffDepartment.id, name: staffDepartment.name })
      .from(staffDepartment)
      .where(
        and(eq(staffDepartment.organizationId, organizationId), eq(staffDepartment.isActive, 1)),
      )
      .orderBy(asc(sql`lower(${staffDepartment.name})`)),
    database
      .select({
        id: staffDesignation.id,
        departmentId: staffDesignation.departmentId,
        name: staffDesignation.name,
      })
      .from(staffDesignation)
      .where(
        and(eq(staffDesignation.organizationId, organizationId), eq(staffDesignation.isActive, 1)),
      )
      .orderBy(asc(sql`lower(${staffDesignation.name})`)),
    database
      .select({ id: staffCategory.id, name: staffCategory.name })
      .from(staffCategory)
      .where(and(eq(staffCategory.organizationId, organizationId), eq(staffCategory.isActive, 1)))
      .orderBy(asc(sql`lower(${staffCategory.name})`)),
  ]);

  const total = Number(countRows[0]?.total ?? 0);
  return {
    staff,
    summary,
    departments,
    designations,
    categories,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize),
    },
  };
}

function escapeLikePattern(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
