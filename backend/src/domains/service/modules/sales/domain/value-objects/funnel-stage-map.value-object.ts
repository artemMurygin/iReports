import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

// Группа воронки сервисных сделок, к которой относится этап (Bitrix
// stageId) — см. serviceFunnelKPICalculation в
// src/TODO/reports/reports.helpers.ts. 'other' — этап не входит ни в один
// из захардкоженных списков легаси-функции (она такие этапы просто не
// считает ни в одном из отдельных счётчиков, но включает в targetedLeads,
// см. FunnelStageMap.classify).
export type FunnelGroup =
    | 'won'
    | 'lose'
    | 'inWork'
    | 'waitingInService'
    | 'inService'
    | 'nonTarget'
    | 'other';

export interface FunnelStageMapProps {
    won: readonly string[];
    lose: readonly string[];
    inWork: readonly string[];
    waitingInService: readonly string[];
    inService: readonly string[];
    nonTarget: readonly string[];
}

// Инкапсулирует захардкоженные массивы Bitrix stage-ID из легаси
// serviceFunnelKPICalculation (inWorkStages/waitingInServiceStages/
// inServiceStages/loseStages/'WON'/'3') — та же группировка, перенесённая
// без изменения бизнес-правила (см. docs/todo-modules-ddd-refactoring,
// Фаза 4: "захардкоженных массивов stage-ID вне VO FunnelStageMap нет").
//
// Инвариант: этап принадлежит ровно одной группе — FunnelStageMap.create()
// (и default()) бросает ArgumentInvalidException, если один и тот же
// stageId встретился в двух группах. Этапы вне всех списков — валидный
// случай ('other'), а не нарушение инварианта: легаси-функция тоже не
// требует полного покрытия всех Bitrix-этапов явной группой.
export class FunnelStageMap extends ValueObject<FunnelStageMapProps> {
    private readonly lookup: ReadonlyMap<string, FunnelGroup>;

    private constructor(props: FunnelStageMapProps) {
        super(props);
        this.lookup = FunnelStageMap.buildLookup(props);
    }

    static create(props: FunnelStageMapProps): FunnelStageMap {
        return new FunnelStageMap(props);
    }

    // Канонический экземпляр — те же группы, что и в легаси
    // serviceFunnelKPICalculation. Единственное место в проекте, где эти
    // stage-ID перечислены буквально.
    static default(): FunnelStageMap {
        return FunnelStageMap.create({
            won: ['WON'],
            lose: [
                '4',
                '8',
                '7',
                '6',
                '5',
                '1',
                'LOSE',
                '2',
                '12',
                'UC_6NHK6F',
                '13',
            ],
            inWork: [
                'UC_U52J7C',
                'UC_HML04K',
                'UC_E2KAHD',
                'NEW',
                'UC_ZR6PTH',
                'UC_X5VJM9',
                'UC_7FXM5Z',
                'UC_CDLDG7',
                'UC_2SD91N',
            ],
            waitingInService: ['EXECUTING'],
            inService: ['UC_UPDA02', 'UC_EWM3W9'],
            nonTarget: ['3'],
        });
    }

    // Единственный метод, реально нужный потребителям (KPI-калькулятору,
    // фильтру по stageGroupIds) — см. YAGNI-комментарий в
    // accounting/application/ports/motivation-schema.port.ts.
    classify(stageId: string | null | undefined): FunnelGroup {
        if (stageId == null) return 'other';
        return this.lookup.get(stageId) ?? 'other';
    }

    private static buildLookup(
        props: FunnelStageMapProps,
    ): Map<string, FunnelGroup> {
        const lookup = new Map<string, FunnelGroup>();
        const groups: [FunnelGroup, readonly string[]][] = [
            ['nonTarget', props.nonTarget],
            ['won', props.won],
            ['lose', props.lose],
            ['inWork', props.inWork],
            ['waitingInService', props.waitingInService],
            ['inService', props.inService],
        ];

        for (const [group, stageIds] of groups) {
            for (const stageId of stageIds) {
                const existingGroup = lookup.get(stageId);
                if (existingGroup) {
                    throw new ArgumentInvalidException(
                        `Этап воронки "${stageId}" принадлежит нескольким группам: "${existingGroup}" и "${group}" — этап должен быть ровно в одной группе`,
                    );
                }
                lookup.set(stageId, group);
            }
        }

        return lookup;
    }
}
