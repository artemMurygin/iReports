import { describe, expect, it } from 'vitest'
import type { EmployeeIdentityResponse } from 'ireports-contracts'

import { buildErpLinkageLabel, buildHeaderSubtitle } from './headerInfo.ts'

function makeIdentity(overrides: Partial<EmployeeIdentityResponse> = {}): EmployeeIdentityResponse {
    return {
        id: 'id-1',
        bitrixEmployeeId: 1,
        system: 'ROAPP',
        identifierType: 'EMPLOYEE_ID',
        externalId: '412',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1),
        ...overrides,
    }
}

describe('buildErpLinkageLabel', () => {
    it('returns null when there are no identities', () => {
        expect(buildErpLinkageLabel([])).toBeNull()
    })

    it('renders a single system', () => {
        expect(buildErpLinkageLabel([makeIdentity({ system: 'ROAPP' })])).toBe('связан с RemOnline')
    })

    it('joins two systems with "и"', () => {
        expect(
            buildErpLinkageLabel([
                makeIdentity({ system: 'ROAPP' }),
                makeIdentity({ id: 'id-2', system: 'MOY_SKLAD' }),
            ]),
        ).toBe('связан с RemOnline и МойСкладом')
    })

    it('de-duplicates several identities in the same system', () => {
        expect(
            buildErpLinkageLabel([
                makeIdentity({ system: 'ROAPP', identifierType: 'EMPLOYEE_ID' }),
                makeIdentity({ id: 'id-2', system: 'ROAPP', identifierType: 'ONLINE_MANAGER_FIELD' }),
            ]),
        ).toBe('связан с RemOnline')
    })
})

describe('buildHeaderSubtitle', () => {
    it('joins non-empty parts with " · "', () => {
        expect(buildHeaderSubtitle(['Отдел сервиса', 'Инженер', 'связан с RemOnline'])).toBe(
            'Отдел сервиса · Инженер · связан с RemOnline',
        )
    })

    it('skips null/undefined/blank parts', () => {
        expect(buildHeaderSubtitle(['Отдел сервиса', null, '  ', undefined])).toBe('Отдел сервиса')
    })

    it('returns null when every part is empty', () => {
        expect(buildHeaderSubtitle([null, undefined, ''])).toBeNull()
    })
})
