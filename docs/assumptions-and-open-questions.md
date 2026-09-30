# PayGrade: assumptions and open questions

For the MMWGH Human Resource Management Office and Accounting Section. The prototype makes the assumptions below so that every screen can be clicked through. Each one should be confirmed or corrected before full development. Numbers are seed values for the prototype only.

## Assumptions built into the prototype

### Payroll cycle and structure

1. **Monthly payroll for both groups.** One period per calendar month (1st to the last day), paid on the last day of the month. There is no mid-month advance.
2. **Separate runs per group.** Plantilla (permanent, casual, contractual) and JO/COS are separate runs with the same workflow.
3. **Monthly amounts are taken in full each period.** This covers salary, PERA, RATA, longevity pay, PhilHealth, Pag-IBIG, ECC, and loan amortizations, prorated only for days not in service.
4. **GSIS is computed on the basic salary actually earned in the month**, after absences and tardiness. PhilHealth and Pag-IBIG are computed on the monthly basic salary.
5. **Withholding tax uses the BIR monthly table**, applied to taxable compensation less employee GSIS, PhilHealth, and Pag-IBIG shares. Year-end annualization is shown only as a projection in the BIR 2316 report.
6. **Runs lock at approval by the Chief of Hospital.** Corrections after approval go through an adjustment in the next period. Returns can go back to Computed or Reviewed, never to Draft.

### Earnings

7. **Daily rate** is monthly basic divided by 22 working days. **Hourly rate** is the daily rate divided by 8. Tardiness and undertime are deducted per minute; absences without pay at the daily rate.
8. **New hires and separations are prorated** by working days in service within the month (weekends and holidays excluded).
9. **PERA** is ₱2,000 a month for plantilla, reduced proportionally for days not in service and absences without pay.
10. **Overtime** is paid at 125% of the hourly rate on regular days and 150% on rest days and holidays (CSC-DBM JC No. 2, s. 2015). Overtime is paid in cash, not compensatory time off.
11. **Night differential** is 20% of the hourly rate for work between 6:00 PM and 6:00 AM. It applies to plantilla at SG 19 and below (RA 11701). JO/COS get none.
12. **RATA** is assigned to four officials (Chief of Hospital, Chief of Medical Professional Staff, Chief Administrative Officer, Chief Nurse) at seed amounts.
13. **Longevity pay** (Magna Carta, RA 7305) is 5% of monthly basic for every five years of service. It is paid in the regular payroll and treated as taxable.
14. **All plantilla employees are public health workers** under RA 7305 and eligible for Magna Carta benefits.
15. **Hazard pay, subsistence (₱50 a day, up to 22 days), and laundry (₱150 a month)** are paid monthly through special payroll, not the regular payroll. Hazard pay rates by salary grade are seed values.

### Deductions

16. **JO/COS have no GSIS and no government share.** PhilHealth and Pag-IBIG employee shares are still deducted at the regular employee rates.
17. **JO/COS withholding is 5% of gross pay** unless a sworn declaration is on file (annual income within the exemption threshold), in which case nothing is withheld.
18. **Loan amortizations** (GSIS, Pag-IBIG, cooperative, Landbank) are deducted in full each month between the start and end months. Suspended loans are skipped.
19. **Net pay below ₱5,000 a month** (the GAA minimum take-home pay) is flagged but not blocked. Loans are not automatically deferred.
20. **Tax treatment:** PERA, RATA, subsistence, laundry, and uniform allowance are non-taxable. Basic salary, longevity pay, overtime, night differential, and manual earning adjustments are taxable. Bonuses and PEI count toward the ₱90,000 exemption for 13th month pay and other benefits.

### Special payroll

21. **Bonuses, cash gift, PEI, and uniform allowance** are for plantilla only. Employees need at least four months of service as of the reference date (May 15 for the Mid-Year Bonus, Oct 31 for the Year-End Bonus). No tax is withheld on special payroll; tax on amounts above the exemption is settled at year-end annualization.

### Rates, schedules, and calendars

22. **Rates in force** (from `src/lib/payroll/rates.ts`, versioned in Settings):
    - GSIS: 9% personal, 12% government, ₱100 ECC a month.
    - PhilHealth: 5% premium on a ₱10,000 floor and ₱100,000 ceiling, split equally.
    - Pag-IBIG: 1% or 2% employee and 2% employer, on up to ₱10,000.
    - BIR: TRAIN law tables effective 2023.
23. **Salary schedule:** SSL VI tranches effective Jan 1, 2024, 2025, and 2026. Step 1 anchors approximate the first tranche and the other cells are derived, so every cell must be replaced with the DBM circular values.
24. **Holidays** for 2025 and 2026 are seed values, used only to count working days.
25. **Remittance due dates:** GSIS on the 10th, PhilHealth on the 15th, Pag-IBIG on the 15th, and BIR 1601-C on the 10th of the following month.
26. **Leave monetization (report only):** up to 10 VL days per application, keeping at least 5 VL days.
27. **Step increments** are shown as due every three years from the last increment or hire date. They are not applied automatically.

### Prototype mechanics

28. **Sign-in is mocked.** Anyone can pick a role. Each role maps to one mock user.
29. **Exports, payslip generation, and document uploads are simulated.** They show a confirmation and write an audit entry but produce no files.
30. **Data lives in the browser's local storage.** Reset demo data restores the seed.

## Open questions for HR and Accounting

### Payroll cycle

1. Payroll is monthly. Is it paid on the last working day of the month, or on a fixed date? Is a mid-month cash advance ever granted?
2. Do JO/COS follow the same monthly schedule, or are they paid after the month once the DTR and accomplishment report are certified?
3. Who prepares the payroll register, and is there a review by the Chief Administrative Officer before Accounting?
4. Is a budget certification step (ORS, Box B) needed as a separate stage in PayGrade?

### Attendance

5. Is tardiness or undertime charged to vacation leave credits first, as CSC rules allow, or always deducted from pay?
6. Are absences charged to leave credits before being treated as leave without pay?
7. What does the biometric system export (device brand, file format, columns)?
8. Who certifies the DTR (immediate supervisor, department head) before HR imports it?
9. How are approved overtime authorities tracked, and is overtime paid in cash or compensatory time off?

### Benefits and allowances

10. What hazard pay rates apply to MMWGH under the DOH risk classification, and are they paid monthly through special payroll or with the regular payroll?
11. Night differential: which basis applies (RA 11701 or the Magna Carta), what rate, and which salary grades?
12. Which positions receive RATA, and at what amounts under the current GAA?
13. Is longevity pay granted, and how are breaks in service counted?
14. How should PERA, RATA, hazard pay, subsistence, and laundry be treated for withholding tax?

### JO/COS

15. Does the hospital deduct PhilHealth and Pag-IBIG from JO/COS, or do workers remit on their own?
16. Is the premium of up to 20% in lieu of leave benefits (CSC-COA-DBM JC No. 1, s. 2017) granted?
17. Which tax treatment is used: 5% or 10% expanded withholding, 3% percentage tax, or the 8% option? How are sworn declarations collected and renewed?
18. Are JO/COS paid a daily rate times days worked, or a fixed monthly contract amount with deductions for absences?

### Deductions and loans

19. When net pay would fall below ₱5,000 a month, which deductions are deferred first (for example cooperative before GSIS)?
20. Which authorized deductions exist beyond GSIS, Pag-IBIG, the cooperative, and Landbank (union dues, mortuary aid, MP2 savings)?

### Separations and bonuses

21. How are final pay, terminal leave, and prorated Mid-Year and Year-End Bonuses computed for separated employees?
22. Do casual and contractual employees receive bonuses, the cash gift, and PEI on the same terms as permanent employees?

### Remittances and outputs

23. What file formats are required for Landbank ATM crediting, GSIS eRPS, PhilHealth EPRS (RF-1), Pag-IBIG MCRF, BIR eFPS or eBIRForms 1601-C, and the alphalist DAT file?
24. Which forms must PayGrade print exactly (General Payroll, payslip, CS Form No. 48, BIR 2316)? Can MMWGH share current samples?
25. Who are the official signatories for each form, and who signs in their absence?

### Controls and access

26. Should rate tables and salary schedules require a second approver (maker and checker) before taking effect?
27. How long must audit logs be retained, and what does COA expect to see in them?
28. How should payslips be distributed (printed, email, employee portal), and what Data Privacy Act measures apply?
29. How many users will need access, and do any roles overlap (for example one person acting as both HR Payroll Officer and Cashier)?
