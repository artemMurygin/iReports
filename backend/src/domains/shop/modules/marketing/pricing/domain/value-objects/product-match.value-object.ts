import { ValueObject } from '@/shared/domain/value-object.base';
import { ArgumentInvalidException } from '@/shared/exceptions';

export type ProductMatchMethod = 'embedding' | 'llm' | 'none';

export interface ProductMatchProps {
    sourceRowName: string;
    sourcePrice: number | null;
    matchedProductId: string | null;
    matchedProductName: string | null;
    method: ProductMatchMethod;
    confidence: number;
}

// Сопоставление строки прайс-листа с товаром МойСклад (см. PRD, раздел 3а: "строка файла ×
// сопоставленный товар МойСклад × способ сопоставления × уверенность") — доменная замена легаси
// `MatchedProduct` (src/TODO/priceMonitoring/priceMonitoring.types.ts), которая предполагала, что
// совпадение всегда найдено (`externalId`/`moyskladName` типизированы как обязательные), а
// реальное отсутствие совпадения выражалось косвенно — ручным фильтром
// `item.price != null && item.externalId != null` в
// PriceMonitoringService.buildMoySkladUpdates/writeResultsToSheet. Здесь отсутствие совпадения —
// явное состояние (method: 'none'), а не то, что "где-то по цепочке оказалось null".
export class ProductMatch extends ValueObject<ProductMatchProps> {
    static create(props: ProductMatchProps): ProductMatch {
        if (!props.sourceRowName.trim()) {
            throw new ArgumentInvalidException(
                'sourceRowName не может быть пустым',
            );
        }
        if (props.sourcePrice != null && props.sourcePrice < 0) {
            throw new ArgumentInvalidException(
                `sourcePrice не может быть отрицательной: ${props.sourcePrice}`,
            );
        }
        if (props.confidence < 0 || props.confidence > 1) {
            throw new ArgumentInvalidException(
                `confidence должна быть в диапазоне [0, 1], получено: ${props.confidence}`,
            );
        }

        if (props.method === 'none') {
            if (
                props.matchedProductId != null ||
                props.matchedProductName != null
            ) {
                throw new ArgumentInvalidException(
                    'Для несопоставленной строки (method: "none") matchedProductId/matchedProductName должны быть null',
                );
            }
        } else {
            if (!props.matchedProductId?.trim()) {
                throw new ArgumentInvalidException(
                    `matchedProductId обязателен для method "${props.method}"`,
                );
            }
            if (!props.matchedProductName?.trim()) {
                throw new ArgumentInvalidException(
                    `matchedProductName обязателен для method "${props.method}"`,
                );
            }
        }

        return new ProductMatch({ ...props });
    }

    getSourceRowName(): string {
        return this.props.sourceRowName;
    }

    getSourcePrice(): number | null {
        return this.props.sourcePrice;
    }

    getMatchedProductId(): string | null {
        return this.props.matchedProductId;
    }

    getMatchedProductName(): string | null {
        return this.props.matchedProductName;
    }

    getMethod(): ProductMatchMethod {
        return this.props.method;
    }

    getConfidence(): number {
        return this.props.confidence;
    }

    isMatched(): boolean {
        return this.props.method !== 'none';
    }
}
