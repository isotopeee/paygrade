import type { AppUser, Department, Role, Signatory } from "@/types"

export const SEED_DEPARTMENTS: Department[] = [
  { id: "dept-psychiatry", code: "PSY", name: "Psychiatry", costCenter: "CC-110", head: "Dr. Rafael S. Navarro" },
  { id: "dept-medical", code: "MED", name: "Medical", costCenter: "CC-100", head: "Dr. Elena R. Bautista" },
  { id: "dept-nursing", code: "NUR", name: "Nursing", costCenter: "CC-200", head: "Rosario T. Magbanua" },
  { id: "dept-laboratory", code: "LAB", name: "Laboratory", costCenter: "CC-310", head: "Kristine A. Lacson" },
  { id: "dept-pharmacy", code: "PHA", name: "Pharmacy", costCenter: "CC-320", head: "Jerome P. Tolentino" },
  { id: "dept-radiology", code: "RAD", name: "Radiology", costCenter: "CC-330", head: "Paolo M. Sarmiento" },
  { id: "dept-dietary", code: "DIE", name: "Dietary", costCenter: "CC-340", head: "Liza G. Soriano" },
  { id: "dept-administrative", code: "ADM", name: "Administrative", costCenter: "CC-400", head: "Antonio V. Pascual" },
  { id: "dept-finance", code: "FIN", name: "Finance", costCenter: "CC-410", head: "Ramon P. Villanueva" },
  { id: "dept-hr", code: "HRM", name: "HR", costCenter: "CC-420", head: "Maricel D. Santos" },
  { id: "dept-security", code: "SEC", name: "Security", costCenter: "CC-510", head: "Rolando B. Castro" },
  { id: "dept-housekeeping", code: "HSK", name: "Housekeeping", costCenter: "CC-520", head: "Divina C. Ramos" },
  { id: "dept-engineering", code: "ENG", name: "Engineering and Maintenance", costCenter: "CC-530", head: "Edgardo L. Valdez" },
]

/** Mock users, one per role. The same people appear as employees in the seed. */
export const SEED_USERS: AppUser[] = [
  {
    id: "user-hr",
    name: "Maricel D. Santos",
    position: "Human Resource Management Officer III",
    role: "hr",
    email: "maricel.santos@mmwgh.doh.gov.ph",
    initials: "MS",
    active: true,
    lastLogin: "2026-09-22T07:42:00.000+08:00",
  },
  {
    id: "user-accountant",
    name: "Ramon P. Villanueva",
    position: "Accountant III",
    role: "accountant",
    email: "ramon.villanueva@mmwgh.doh.gov.ph",
    initials: "RV",
    active: true,
    lastLogin: "2026-09-22T08:05:00.000+08:00",
  },
  {
    id: "user-chief",
    name: "Dr. Elena R. Bautista",
    position: "Chief of Hospital II",
    role: "chief",
    email: "elena.bautista@mmwgh.doh.gov.ph",
    initials: "EB",
    active: true,
    lastLogin: "2026-09-21T16:20:00.000+08:00",
  },
  {
    id: "user-cashier",
    name: "Josefina L. Mercado",
    position: "Cashier II",
    role: "cashier",
    email: "josefina.mercado@mmwgh.doh.gov.ph",
    initials: "JM",
    active: true,
    lastLogin: "2026-09-19T15:10:00.000+08:00",
  },
  {
    id: "user-admin",
    name: "Carlo M. Reyes",
    position: "Information Technology Officer I",
    role: "admin",
    email: "carlo.reyes@mmwgh.doh.gov.ph",
    initials: "CR",
    active: true,
    lastLogin: "2026-09-18T10:02:00.000+08:00",
  },
  {
    id: "user-hr-2",
    name: "Angelica F. Ocampo",
    position: "Human Resource Management Officer II",
    role: "hr",
    email: "angelica.ocampo@mmwgh.doh.gov.ph",
    initials: "AO",
    active: true,
    lastLogin: "2026-09-17T09:31:00.000+08:00",
  },
  {
    id: "user-acct-2",
    name: "Nerissa B. Dizon",
    position: "Accountant II",
    role: "accountant",
    email: "nerissa.dizon@mmwgh.doh.gov.ph",
    initials: "ND",
    active: false,
    lastLogin: "2026-06-30T17:45:00.000+08:00",
  },
]

export function userForRole(role: Role): AppUser {
  const user = SEED_USERS.find((u) => u.role === role && u.active)
  if (!user) throw new Error(`No user for role ${role}`)
  return user
}

export const SEED_SIGNATORIES: Signatory[] = [
  { id: "sig-prepared", role: "prepared_by", label: "Prepared by", name: "Maricel D. Santos", position: "HRMO III" },
  { id: "sig-reviewed", role: "reviewed_by", label: "Reviewed by", name: "Antonio V. Pascual", position: "Chief Administrative Officer" },
  { id: "sig-certified", role: "certified_by", label: "Certified by", name: "Ramon P. Villanueva", position: "Accountant III" },
  { id: "sig-approved", role: "approved_by", label: "Approved by", name: "Dr. Elena R. Bautista", position: "Chief of Hospital II" },
  { id: "sig-released", role: "released_by", label: "Released by", name: "Josefina L. Mercado", position: "Cashier II" },
]
