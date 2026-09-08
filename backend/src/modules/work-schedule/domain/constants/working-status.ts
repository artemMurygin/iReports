// Статус «работает» графика (WorkScheduleStatus) как именованная константа
// (Фаза 5, docs/employee-work-schedule/plan-employee-work-schedule.md) —
// вынесена сюда, а не литерал 'WORKING' в каждом месте: источник часов
// PayPerHour (ServiceCalculationDataRepository/ShopCalculationDataRepository,
// оба домена) и разовая миграция EmployeeHoursEntry → WorkScheduleEntry
// фильтруют записи графика по этому статусу — единая точка, если набор
// статусов когда-нибудь переименуют.
export const WORKING_STATUS = 'WORKING';
