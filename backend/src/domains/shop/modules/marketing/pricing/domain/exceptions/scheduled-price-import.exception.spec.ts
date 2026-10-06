import { withRequestContext } from '@/shared/testing/with-request-context';
import {
    PriceImportAlreadyRunningException,
    PriceListFileAmbiguousException,
    PriceListFileNotFoundException,
} from './scheduled-price-import.exception';

describe('scheduled-price-import exceptions', () => {
    it('бросаются как Error с понятным сообщением', () =>
        withRequestContext(() => {
            expect(new PriceListFileNotFoundException().message).toMatch(
                /папк/i,
            );
            expect(new PriceListFileAmbiguousException(2).message).toContain(
                '2',
            );
            expect(new PriceImportAlreadyRunningException().message).toMatch(
                /выполня/i,
            );
        }));
});
