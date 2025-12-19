-- Create separate databases for each service
CREATE DATABASE harbor_user;
CREATE DATABASE harbor_wallet;
CREATE DATABASE harbor_tendering;
CREATE DATABASE harbor_settlement;

-- Enable UUID extension in each database
\c harbor_user;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c harbor_wallet;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c harbor_tendering;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c harbor_settlement;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
