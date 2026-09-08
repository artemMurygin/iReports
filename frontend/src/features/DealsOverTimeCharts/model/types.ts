export type LeadsEntry = {
    date: string
    _originalDate: string
    [source: string]: number | string
}

export type Tab = 'grid' | 'chart'
