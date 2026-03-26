import Deals from '../services/deals.service';

const [fromDate = undefined, fromField = 'MODIFY'] = process.argv.slice(2);

if (fromField !== 'MODIFY' && fromField !== 'CREATE') {
    console.error(`Invalid fromField: "${fromField}". Must be "MODIFY" or "CREATE".`);
    process.exit(1);
}

const date = fromDate ? new Date(fromDate) : undefined;

Deals.getCreatedlDeals(date).then(() => {}).catch(err => {
    console.error('Error uploading deals:', err);
})