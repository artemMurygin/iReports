import { avito } from '../shared/axios.instance';


class AvitoService {
    async getAdvertisements() {
        try {
            const { data } = await avito.get('/core/v1/items')
            console.log(data)
            return data;
        } catch (error) {
            console.log('[AvitoService] Error fetching advertisements:', error);
            throw error;
        }
    }
}

const Avito = new AvitoService();

Avito.getAdvertisements()
export default Avito;