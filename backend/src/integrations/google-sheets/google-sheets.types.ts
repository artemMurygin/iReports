export type SheetRow = string[];

export type RangeData = {
  range: string;
  values: SheetRow[];
};

export type GetRowsOptions = {
  /** A1-нотация, например 'Sheet1!A1:Z1000' или просто 'Sheet1' */
  range: string;
  /** Как интерпретировать значения: FORMATTED_VALUE | UNFORMATTED_VALUE | FORMULA */
  valueRenderOption?: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA';
};
