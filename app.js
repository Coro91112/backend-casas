import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import routes from './index.js';
import cors from 'cors'

const app = express();
app.use(express.json());
app.use(cors())

await mongoose.connect(process.env.MONGODB_URI, { dbName: 'BackendCasas' });
console.log('Conectado a la base de datos');

app.use('/', routes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`Servidor escuchando en http://localhost:${PORT}`)
);
