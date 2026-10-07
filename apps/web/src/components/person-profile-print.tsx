import { useState } from "react";

import { OrganizationLogo } from "@/components/organization-brand";
import type { Profile } from "@/components/person-profile-sheet";

// The paper version of a profile. It is laid out for A4 rather than reusing the
// side panel, so a whole record fits on one or two sheets.
export function PersonProfilePrint({
  legacyAcademicRecords,
  photoUrl,
  profile,
}: {
  legacyAcademicRecords: Profile["academicRecords"];
  photoUrl: string | null;
  profile: Profile;
}) {
  const isStaff = profile.kind === "staff";
  const family = profile.family;
  const currentPlacement = profile.placements.find((placement) => placement.isCurrent);
  const latestEnrollment = profile.schoolEnrollments[0];
  const latestRecord = profile.academicRecords.find((record) => record.isLatest);
  const currentClass = latestEnrollment
    ? [latestEnrollment.className, latestEnrollment.academicSession].join(" · ")
    : latestRecord
      ? [latestRecord.className, latestRecord.academicSession].join(" · ")
      : null;
  const category =
    profile.childCategories.find((item) => item.id === profile.childCategoryId)?.name ?? null;
  const guardians = family
    ? [
        {
          label: "Primary guardian",
          name: family.guardian1Name,
          phone: joined([family.guardian1Mobile, family.guardian1Phone], " / "),
          email: family.guardian1Email,
          address: family.guardian1Address,
        },
        {
          label: "Secondary guardian",
          name: family.guardian2Name,
          phone: joined([family.guardian2Mobile, family.guardian2Phone], " / "),
          email: family.guardian2Email,
          address: family.guardian2Address,
        },
      ].filter((guardian) =>
        [guardian.name, guardian.phone, guardian.email, guardian.address].some(Boolean),
      )
    : [];
  const hasWithdrawal = Boolean(
    profile.withdrawnOn || profile.withdrawalReason || profile.withdrawalRemarks,
  );
  const documents = profile.files.filter((file) => file.category === "document");
  const hasSchoolHistory = profile.schoolEnrollments.length + legacyAcademicRecords.length > 0;
  // A column nobody has a value for is left off the page.
  const showHouse =
    profile.schoolEnrollments.some((item) => item.houseName) ||
    legacyAcademicRecords.some((item) => item.houseName);
  const showRoll =
    profile.schoolEnrollments.some((item) => item.rollNumber) ||
    legacyAcademicRecords.some((item) => item.rollNumber);
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <article className="person-profile-paper">
      <header className="ppp-masthead">
        <div className="ppp-brand">
          <OrganizationLogo className="ppp-logo" />
          <div>
            <p className="ppp-eyebrow">{profileTitle(profile.kind)}</p>
            <p className="ppp-organization">{profile.organizationName}</p>
          </div>
        </div>
        <p className="ppp-printed">Printed {formatDate(new Date().toISOString())}</p>
      </header>

      <section className="ppp-hero">
        {photoUrl && !photoFailed ? (
          <img alt="" className="ppp-photo" onError={() => setPhotoFailed(true)} src={photoUrl} />
        ) : (
          <div className="ppp-photo ppp-photo-empty">No photo</div>
        )}
        <div className="ppp-hero-body">
          <div className="ppp-name-row">
            <h1 className="ppp-name">{profile.displayName}</h1>
            <span
              className={`ppp-status ${profile.status === "active" ? "ppp-status-active" : ""}`}
            >
              {profile.status === "active" ? "Active" : "Inactive"}
            </span>
          </div>
          <dl className="ppp-grid ppp-grid-4">
            <Field
              label={profile.identifierKind === "staff" ? "Staff number" : "Admission number"}
              mono
              value={profile.primaryIdentifier}
            />
            <Field label="Gender" value={genderLabel(profile.gender)} />
            <Field label="Date of birth" value={formatDate(profile.dateOfBirth)} />
            <Field
              label={isStaff ? "Joining date" : "Admission date"}
              value={formatDate(profile.admittedOrJoinedOn)}
            />
            {isStaff ? (
              <Field label="Campus / work location" value={profile.campusOrLocation} />
            ) : (
              <>
                <Field
                  label={profile.status === "active" ? "Current class" : "Last class"}
                  value={currentClass}
                />
                <Field
                  label="School"
                  value={latestEnrollment?.schoolName ?? latestRecord?.schoolName ?? null}
                />
                <Field
                  label="Home"
                  value={
                    currentPlacement
                      ? distinct([currentPlacement.homeName, currentPlacement.locationName], ", ")
                      : null
                  }
                />
              </>
            )}
            {profile.kind === "child" ? <Field label="Child category" value={category} /> : null}
          </dl>
        </div>
      </section>

      <Section title="Identity">
        <dl className="ppp-grid ppp-grid-4">
          <Field label="Nationality" value={profile.nationality} />
          <Field label="RC number" mono value={profile.registrationCertificateNumber} />
          <Field label="IC number" mono value={profile.identityCertificateNumber} />
          <Field label="Aadhaar number" mono value={profile.aadhaarNumber} />
          {isStaff ? null : (
            <>
              <Field label="Green Book number" mono value={profile.greenBookNumber} />
              <Field label="Education number" mono value={profile.educationNumber} />
            </>
          )}
          {profile.kind === "child" ? (
            <>
              <Field label="Previous school" value={profile.previousSchoolName} />
              <Field label="TC number" mono value={profile.transferCertificateNumber} />
            </>
          ) : null}
        </dl>
      </Section>

      {hasWithdrawal ? (
        <Section title="Withdrawal">
          <dl className="ppp-grid ppp-grid-4">
            <Field label="Withdrawn date" value={formatDate(profile.withdrawnOn)} />
            <Field label="Reason" value={profile.withdrawalReason} />
            <Field className="ppp-span-2" label="Remarks" value={profile.withdrawalRemarks} />
          </dl>
        </Section>
      ) : null}

      {family || profile.relationships.length ? (
        <Section title="Family">
          {family ? (
            <dl className="ppp-grid ppp-grid-4">
              <Field label="Mother" value={family.motherName} />
              <Field label="Mother's occupation" value={family.motherOccupation} />
              <Field label="Father" value={family.fatherName} />
              <Field label="Father's occupation" value={family.fatherOccupation} />
              <Field label="Parents' status" value={family.parentageStatus} />
              <Field label="Family phone" value={family.parentsPhone} />
              <Field
                className="ppp-span-2"
                label="Permanent address"
                value={family.parentsPermanentAddress}
              />
              {family.maritalStatus || family.spouseName || family.numberOfChildren ? (
                <>
                  <Field
                    label="Marital status"
                    value={withDetail(family.maritalStatus, family.spouseName)}
                  />
                  <Field label="Number of children" value={family.numberOfChildren} />
                </>
              ) : null}
            </dl>
          ) : null}

          {guardians.length ? (
            <div className="ppp-guardians">
              {guardians.map((guardian) => (
                <div className="ppp-guardian" key={guardian.label}>
                  <p className="ppp-label">{guardian.label}</p>
                  <p className="ppp-value">{guardian.name || "—"}</p>
                  <p className="ppp-detail">
                    {joined([guardian.phone, guardian.email], " · ") || "No contact recorded"}
                  </p>
                  {guardian.address ? <p className="ppp-detail">{guardian.address}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          {profile.relationships.length ? (
            <div className="ppp-inline-list">
              <span className="ppp-label">Siblings</span>
              <span>
                {profile.relationships
                  .map(
                    (sibling) =>
                      `${sibling.displayName} (${sibling.primaryIdentifier}${sibling.status === "inactive" ? ", inactive" : ""})`,
                  )
                  .join("  ·  ")}
              </span>
            </div>
          ) : null}
        </Section>
      ) : null}

      {hasSchoolHistory || profile.placements.length ? (
        <div className={hasSchoolHistory && profile.placements.length ? "ppp-columns" : ""}>
          {hasSchoolHistory ? (
            <Section title="School history">
              <table className="ppp-table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Class</th>
                    <th>School</th>
                    {showHouse ? <th>House</th> : null}
                    {showRoll ? <th>Roll</th> : null}
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.schoolEnrollments.map((enrollment) => (
                    <tr key={enrollment.id}>
                      <td className="ppp-nowrap">{enrollment.academicSession}</td>
                      <td>{enrollment.className}</td>
                      <td>{enrollment.schoolName || "—"}</td>
                      {showHouse ? <td>{enrollment.houseName || "—"}</td> : null}
                      {showRoll ? <td>{enrollment.rollNumber || "—"}</td> : null}
                      <td>
                        {capitalize(enrollment.status)}
                        <Detail
                          value={joined(
                            [
                              enrollment.endedOn ? formatDate(enrollment.endedOn) : null,
                              enrollment.endReason,
                            ],
                            " · ",
                          )}
                        />
                      </td>
                    </tr>
                  ))}
                  {legacyAcademicRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="ppp-nowrap">{record.academicSession}</td>
                      <td>{joined([record.className, record.classSection], " ")}</td>
                      <td>{record.schoolName || "—"}</td>
                      {showHouse ? <td>{record.houseName || "—"}</td> : null}
                      {showRoll ? <td>{record.rollNumber || "—"}</td> : null}
                      <td>
                        {record.isLatest ? "Latest" : "Recorded"}
                        <Detail
                          value={joined(
                            [
                              record.result,
                              record.description,
                              record.boardRegistrationNumber
                                ? `Board reg. ${record.boardRegistrationNumber}`
                                : null,
                            ],
                            " · ",
                          )}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          {profile.placements.length ? (
            <Section title="Home history">
              <table className="ppp-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Home</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.placements.map((placement) => (
                    <tr key={placement.id}>
                      <td className="ppp-nowrap">
                        {formatDate(placement.startedOn)}
                        <Detail
                          value={
                            placement.endedOn
                              ? `to ${formatDate(placement.endedOn)}`
                              : placement.isCurrent
                                ? "Current"
                                : ""
                          }
                        />
                      </td>
                      <td>
                        {placement.homeName}
                        <Detail value={joined([placement.reason, placement.remarks], " · ")} />
                      </td>
                      <td>{distinct([placement.locationName, placement.placementType]) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}
        </div>
      ) : null}

      {documents.length ? (
        <Section title="Documents on file">
          <p className="ppp-documents">{documents.map((file) => file.label).join("  ·  ")}</p>
        </Section>
      ) : null}
    </article>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="ppp-section">
      <h2 className="ppp-section-title">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  className,
  label,
  mono = false,
  value,
}: {
  className?: string;
  label: string;
  mono?: boolean;
  value: string | null;
}) {
  return (
    <div className={className}>
      <dt className="ppp-label">{label}</dt>
      <dd className={`ppp-value ${mono && value ? "ppp-mono" : ""} ${value ? "" : "ppp-empty"}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function Detail({ value }: { value: string }) {
  return value ? <span className="ppp-cell-detail">{value}</span> : null;
}

function profileTitle(kind: Profile["kind"]): string {
  if (kind === "staff") return "Staff profile";
  if (kind === "elderly") return "Elder profile";
  return "Student profile";
}

function genderLabel(gender: Profile["gender"]): string | null {
  return gender && gender !== "unknown" ? capitalize(gender) : null;
}

function joined(values: Array<string | null | undefined>, separator: string): string {
  return values.filter(Boolean).join(separator);
}

// Location and placement type are often the same word in imported records.
function distinct(values: Array<string | null | undefined>, separator = " · "): string {
  return [...new Set(values.filter(Boolean))].join(separator);
}

function withDetail(name: string | null, detail: string | null): string | null {
  if (!name) return detail;
  return detail ? `${name} (${detail})` : name;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
