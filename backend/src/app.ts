import 'dotenv/config';
import express from 'express';
import { serverConfig } from './config/server';
import router from './routes/index';
import Deals from './services/deals.service';

const app = express();

serverConfig(app)

app.use('/api', router);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});

