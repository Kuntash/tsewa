# Legacy feature parity

This is the source of truth for Tsewa v0 scope. A screen existing in the old
ASP.NET application is not enough reason to rebuild it. We first check whether
the corresponding legacy tables contain real data and, where possible, whether
that data continued into recent academic sessions.

The immediate goal is to let Tibetan Homes Foundation test the workflows it
still uses. Historical or empty modules can follow after v0 if staff confirm
that they are still needed.

## How to read this checklist

- **Done**: usable in Tsewa now.
- **Partial**: data can be viewed, but the legacy editing workflow is not yet
  available.
- **Build for v0**: supported by recent legacy data or required to maintain the
  current records.
- **After v0**: the database shows historical use, but no meaningful recent
  activity.
- **Do not build yet**: the legacy table is empty or database usage cannot be
  established. Confirm with THF before implementation.

Recent means a row is tied to the 2020–2026 academic sessions. This is a useful
signal, not proof of the last time a screen was opened. Read-only reports and
print actions generally leave no database record and therefore need staff
confirmation.

## Evidence snapshot

Counts were measured on 11 August 2026 from
`data-migration/d1/tibethomes-newer-d1.sqlite`, the local SQLite export prepared
from the 17 GB `TibetHomes.mdf`. The source MDF remains unchanged.

| Legacy data                                | Total rows | 2020–2026 rows | 2026 rows | What it tells us                                |
| ------------------------------------------ | ---------: | -------------: | --------: | ----------------------------------------------- |
| People (`beneficiary`)                     |      8,633 |          3,879 |     1,067 | Core person records are still active data.      |
| School/class history (`beneficiary_class`) |     25,427 |         10,156 |     1,250 | Current school placement is a v0 workflow.      |
| Home placement (`beneficeary_home`)        |     18,151 |          8,566 |     1,304 | Home changes are a v0 workflow.                 |
| Documents                                  |     18,836 |          7,897 |       894 | Viewing and adding documents belong in v0.      |
| Sibling links                              |      1,105 |            971 |       409 | Family relationship editing belongs in v0.      |
| Holidays                                   |      6,043 |              1 |         0 | Historically used; not a v0 priority.           |
| Mark sheets                                |        311 |              0 |         0 | Used only in the 2011/2012 sessions.            |
| Medical diagnoses                          |      2,539 |              0 |         0 | Substantial history, but no recent session use. |
| Scholarships                               |        722 |              0 |         0 | Substantial history, but no recent session use. |
| Sponsor links                              |      4,510 |              0 |         0 | Substantial history, but no recent session use. |
| Staff                                      |        439 |              7 |         0 | Preserve and view now; editing can follow v0.   |
| Staff leave                                |        356 |              1 |         0 | Historically used; not a v0 priority.           |

The legacy promotion page exists, but only **2 of 25,427** class-history rows
contain a promotion result. Both rows are for the same student, on 10 May 2011,
with `Qualified` and the same promotion note. Only those two rows also link to a
marks-detail record. This is evidence that the promotion screen was tried, not
evidence of a regularly used year-end workflow.

## v0: workflows the data says THF still uses

### People and current records

- [x] Search and filter children, elderly people, and staff.
- [x] View core personal information.
- [x] View parents, guardians, siblings, and household information.
- [x] View school, class, house, and home history.
- [x] View photos and documents with authenticated file access.
- [x] Create a basic new student and enrollment in the practice organization.
- [x] Edit a person's core details with validation and an audit entry. Test
      changes in the practice school rather than on migrated THS records.
- [x] Add and edit parents and guardians; link, create, and remove sibling
      relationships with reciprocal profile visibility.
- [x] Add and change a person's home placement while preserving history.
- [x] Upload, name, replace, and remove documents and photos.
- [ ] Record and correct withdrawal information and reasons on the person profile.

### School operations

- [x] Select an academic session.
- [x] View schools, classes, houses, rosters, and student placements.
- [x] View imported academic history.
- [x] Admit a new student in the practice organization.
- [x] Change class or house, move school, transfer out, withdraw, or complete an
      enrollment. Test changes in the practice school rather than on migrated
      THS records.
- [x] Create and edit schools, including affiliation number, location, and active status.
- [ ] Create and edit classes/sections and houses.
- [ ] Assign classes and houses to a school.
- [x] Correct a current enrollment while preserving imported source references
      and change history.
- [ ] Provide simple printable/exportable student lists and class rosters.

### Data completion before v0 sign-off

- [x] Copy all 46,938 referenced media files to the self-hosted R2 bucket.
- [x] Reconcile target byte sizes and SHA-256 hashes.
- [ ] Test the complete v0 workflow in **Tsewa Practice School** without changing
      imported THS records.
- [ ] Let THF staff test the same workflow and record missing fields or steps.

## After v0: real historical use, but not recent use

These features should remain visible in the parity plan because the old
database contains meaningful records. They should not delay school testing.

### Academic marks and results

- [x] Preserve and display imported historical marks and results.
- [ ] Configure subjects, subject types, subject heads, terms, assessments,
      evaluation types, grades, and their class mappings.
- [ ] Create and edit mark sheets.
- [ ] Support draft, verification, and final locking.
- [ ] Confirm whether Excel marks import is still wanted.
- [ ] Generate and print student results and result summaries.

Evidence: 311 mark sheets and 17,821 mark-detail rows exist, but all mark sheets
belong to the 2011 or 2012 session.

### Promotion

- [ ] Confirm with THF whether they want to revive bulk promotion.
- [ ] If confirmed, build student selection, target school/class, session, date,
      result, and notes.
- [ ] Add preview, validation, audit history, and rollback as safety improvements.

Evidence: the ASP.NET page exists, but only two populated promotion records were
found, both for one student in 2011. Promotion is therefore not required for the
first v0 school test.

### Health and dispensary

- [ ] Preserve and expose historical medical records with stricter permissions.
- [ ] Outpatient and inpatient visits.
- [ ] Diagnoses, tests, treatment, referrals, and medical notes.
- [ ] TB registration, treatment details, and outcomes.
- [ ] Medical advances and settlements.
- [ ] Medical reports.

Evidence: 2,539 diagnoses, 2,524 diagnosis details, 112 TB records, 231 TB
details, 23 advances, and 47 advance details exist. None are tied to a 2020–2026
session. The `beneficiary_health`, `hepatitis_b`, `tb_dose`, and
`thf_admited_patient` tables are empty.

### Scholarships

- [ ] Preserve and expose historical scholarship records.
- [ ] Courses, categories, and scholarship heads.
- [ ] Scholarship student records and annual details.
- [ ] Sanctions, sanction details, and advances.
- [ ] Scholarship reports.

Evidence: 722 scholarship records, 1,243 annual details, 1,402 sanctions, and
4,319 sanction details exist, but none are tied to a 2020–2026 session.

### Sponsorship

- [ ] Preserve and expose historical sponsors and beneficiary links.
- [ ] Individual and organization sponsors.
- [ ] Sponsor assignments, status, funds, and remittances.
- [ ] Correspondence and visitors.
- [ ] Sponsorship reports.

Evidence: 3,073 individuals, 32 sponsor organizations, 4,510 beneficiary-sponsor
links, 712 fund details, 16 letters, and 19 visitors exist. None of the sponsor
links are tied to a 2020–2026 session. The separate `sponsorship` and
`beneficiary_funds` tables are empty.

### Staff, leave, holidays, and stipends

- [x] Preserve staff in the shared people registry.
- [ ] Edit staff employment, department, designation, and contact details.
- [ ] Staff dependants, qualifications, experience, and transfers.
- [ ] Staff leave and extra duty.
- [ ] Student holidays and return dates.
- [ ] Stipend and beneficiary ledger workflows.

Evidence: 439 staff, 356 leave-ledger entries, 6,043 student holiday entries,
615 beneficiary-ledger entries, and 453 people with a non-zero stipend amount
exist. Only one holiday row, one leave row, and seven staff records are tied to
2020–2026 sessions. `extra_duty`, `fee`, and the payout tables are empty.

## Do not build without confirmation

- [ ] Standalone attendance: no attendance-entry page or attendance table was
      found. Attendance appears only inside legacy result reporting.
- [ ] Alumni workflow: the `alumini` table is empty.
- [ ] Medical inventory: no medicine inventory workflow or populated inventory
      table was found.
- [ ] Payout workflow: `pay_out` and `pay_out_details` are empty.
- [ ] General asset management: `asset` contains migrated binary/file metadata,
      not evidence of an operational asset-management module.
- [ ] Exact Crystal Reports catalogue: the database stores 73 report definitions,
      but generated reports leave no reliable usage trail. Ask staff which outputs
      they still print.
- [ ] Exact database-backup screen: replace it with documented D1/R2 export and
      restore procedures rather than reproducing a SQL Server button.

## Recommended implementation order

1. Editable core person details.
2. Editable family relationships.
3. Document and photo upload/editing.
4. School, class/section, house, and assignment editing.
5. Printable/exportable rosters and person records confirmed by THF.
6. Practice-school end-to-end testing, followed by controlled enablement for THF.
7. Reassess the historical modules with staff before planning v1.

Update this document whenever a feature is shipped, new legacy usage evidence is
found, or THF confirms that a historically used workflow is still required.
