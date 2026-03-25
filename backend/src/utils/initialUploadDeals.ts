import Deals from '../services/deals.service';

const [fromDate = null, fromField = 'MODIFY'] = process.argv.slice(2);

if (fromField !== 'MODIFY' && fromField !== 'CREATE') {
    console.error(`Invalid fromField: "${fromField}". Must be "MODIFY" or "CREATE".`);
    process.exit(1);
}

Deals.uploadDeals(fromDate, fromField).then(() => {}).catch(err => {
    console.error('Error uploading deals:', err);
})