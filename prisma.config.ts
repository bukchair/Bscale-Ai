import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/bscale_integrations';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});
