// UI-константы для отображения badge-ей этапов
export const stageBadgeConfig: Record<string, { bg: string; text: string; label: string }> = {
  NEW:         { bg: "#ede9fe", text: "#7c3aed", label: "Новый" },
  QUALIFIED:   { bg: "#dbeafe", text: "#2563eb", label: "Квалификация" },
  PROPOSAL:    { bg: "#fef3c7", text: "#d97706", label: "Предложение" },
  NEGOTIATION: { bg: "#f3e8ff", text: "#7c3aed", label: "Переговоры" },
  WON:         { bg: "#dcfce7", text: "#16a34a", label: "Выиграно" },
  LOST:        { bg: "#fee2e2", text: "#dc2626", label: "Потеряно" },
}
