/** One department/employee option from the Bitrix directory — same shape both `getDepartments` and
 * `getEmployees` resolve to (see `pages/SalaryRules/ui/SalaryRulesTargetCard.tsx`, the original
 * definition of this type before the move). */
export type TargetOption = { id: number; name: string }
