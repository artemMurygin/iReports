declare const BX24: {
    openPath: (path: string, callback?: (result: { result: string }) => void) => void
}

export function useBX24() {
    const openDeal = (id: number) => {
        BX24.openPath(`/crm/deal/details/${id}/`)
    }
    return { openDeal }
}
