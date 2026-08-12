import { withRequestContext } from '@/shared/testing/with-request-context';
import { FunnelStageMap } from './funnel-stage-map.value-object';

describe('FunnelStageMap', () => {
    describe('default()', () => {
        const stageMap = FunnelStageMap.default();

        it('классифицирует каждую легаси-группу так же, как serviceFunnelKPICalculation', () => {
            expect(stageMap.classify('WON')).toBe('won');
            expect(stageMap.classify('3')).toBe('nonTarget');
            expect(stageMap.classify('LOSE')).toBe('lose');
            expect(stageMap.classify('4')).toBe('lose');
            expect(stageMap.classify('UC_6NHK6F')).toBe('lose');
            expect(stageMap.classify('NEW')).toBe('inWork');
            expect(stageMap.classify('UC_U52J7C')).toBe('inWork');
            expect(stageMap.classify('EXECUTING')).toBe('waitingInService');
            expect(stageMap.classify('UC_UPDA02')).toBe('inService');
            expect(stageMap.classify('UC_EWM3W9')).toBe('inService');
        });

        it('возвращает "other" для этапа вне всех легаси-списков', () => {
            expect(stageMap.classify('SOME_UNKNOWN_STAGE')).toBe('other');
        });

        it('возвращает "other" для null/undefined stageId', () => {
            expect(stageMap.classify(null)).toBe('other');
            expect(stageMap.classify(undefined)).toBe('other');
        });
    });

    describe('create()', () => {
        it('принимает набор групп, где каждый этап встречается не более одного раза', () => {
            expect(() =>
                FunnelStageMap.create({
                    won: ['WON'],
                    lose: ['LOSE'],
                    inWork: ['NEW'],
                    waitingInService: ['EXECUTING'],
                    inService: [],
                    nonTarget: ['3'],
                }),
            ).not.toThrow();
        });

        it('отклоняет этап, принадлежащий двум группам одновременно', () => {
            withRequestContext(() => {
                expect(() =>
                    FunnelStageMap.create({
                        won: ['DUPLICATE'],
                        lose: ['DUPLICATE'],
                        inWork: [],
                        waitingInService: [],
                        inService: [],
                        nonTarget: [],
                    }),
                ).toThrow();
            });
        });
    });
});
