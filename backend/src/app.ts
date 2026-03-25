import express from 'express';
import { serverConfig } from './config/server.js';
import router from './routes/index.js';

const app = express();

app.use(express.json());
app.use('/api', router);

app.listen(serverConfig.port, () => {
  console.log(`Server running on port ${serverConfig.port}`);
});