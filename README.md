# Simple Connex Backend API

A RESTful API backend for a Coffee Shop & Restaurant Management System built with Node.js, Express, TypeScript, Prisma ORM, and PostgreSQL.

The API provides endpoints for authentication, role-based access control, location management, menu item customization, order processing with balance transactions, and analytics dashboard reporting.

## Related Repositories

* **Frontend Dashboard:** [simple-connex](https://github.com/o-redchenko/simple-connex) — React 19 / TypeScript / Tailwind CSS web application.

---

## Key Features

- Authentication & Role-Based Access Control (RBAC):
  - User registration and login using JWT and bcrypt password hashing.
  - Role management for Customer, Staff, and Admin permissions.
- Menu & Catalog Management:
  - Multi-level catalog hierarchy: Base Items, Menu Categories, and Menu Items.
  - Flexible Variation Categories (e.g., Size, Temperature) and Modifier Categories (e.g., Syrups, Milk Alternatives).
- Location Management:
  - Operating hours configuration, service modes (Dine-in, Takeout, Delivery), and image attachments.
- Orders & Balance System:
  - Atomic Prisma database transactions for balance top-ups and order payments.
  - Order status lifecycle tracking (Pending, Preparing, Ready, Delivered, Cancelled).
- Dashboard & Analytics:
  - Aggregated metrics for total revenue, new user registrations, top-selling items, and location performance.
  - Hourly transaction charts and historical activity breakdowns.

---

## Tech Stack

- Core: Node.js, Express.js (v5), TypeScript 5
- Database & ORM: PostgreSQL 17, Prisma ORM (v6)
- Authentication: JSON Web Tokens (jwt), bcrypt
- Infrastructure: Docker, Docker Compose (PostgreSQL, pgAdmin 4)
- Testing: Jest, Supertest
- Environment & Tooling: ts-node-dev, concurrently, dotenv

---

## Project Structure

```text
simple-connex-backend/
├── __tests__/             # Integration and unit tests
├── prisma/                # Database schema and migrations
│   ├── migrations/        # SQL migration history
│   └── schema.prisma      # Prisma schema definition
├── scripts/               # Database management & CLI generation utilities
│   ├── cleanDatabase.js   # Wipes database tables
│   ├── createAdmin.js     # Seeds or updates admin account
│   ├── generateData.js    # CLI tool for mock user/order generation
│   └── seedDatabase.js    # Base database seeding script
├── src/
│   ├── config/            # Prisma client instance
│   ├── middleware/        # JWT authentication & role authorization
│   ├── routes/            # Express endpoint routers
│   ├── types/             # Domain and API DTO TypeScript definitions
│   ├── utils/             # Validation, response helpers, and error handlers
│   └── server.ts          # Express application entry point
├── docker-compose.yml     # PostgreSQL and pgAdmin service config
└── tsconfig.json          # TypeScript compiler configuration
```

---

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- Docker & Docker Compose (optional, for local PostgreSQL instance)
- npm or pnpm

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone [https://github.com/o-redchenko/simple-connex-backend.git](https://github.com/o-redchenko/simple-connex-backend.git)
cd simple-connex-backend
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/coffee_shop?schema=public"
JWT_SECRET="your-super-secret-jwt-key"

# Admin Setup (Optional for scripts/createAdmin.js)
ADMIN_EMAIL="admin@coffee.com"
ADMIN_PASSWORD="AdminPassword123!"
```

### 3. Database Setup

Start local PostgreSQL and pgAdmin via Docker Compose:

```bash
npm run db:up
```

Run Prisma migrations to create the database schema:

```bash
npx prisma migrate dev
```

Seed initial administrative and test data:

```bash
npm run create-admin
npm run seed
```

### 4. Running the Server

Start the server in development mode:

```bash
npm run dev
```

The server will start at `http://localhost:3000`.

---

## Available Scripts

- `npm run dev` - Starts Docker container, waits for Database, and runs `ts-node-dev` server.
- `npm run build` - Compiles TypeScript code to `dist/`.
- `npm run start` - Runs the compiled production code from `dist/server.js`.
- `npm run create-admin` - Upserts the default admin user into the database.
- `npm run seed` - Seeds initial location, menu, and user data.
- `npm run seed-full-orders` - Generates mock orders and balance top-ups.
- `npm run generate <command> <count> <month>` - CLI generator tool for mock customers, orders, or top-ups.
- `npm run clean` - Clears data across all database tables.
- `npm run type-check` - Runs TypeScript type checking without generating build output.

---

## Main API Endpoints Summary

| Method | Endpoint                  | Description                          | Access        |
| :----- | :------------------------ | :----------------------------------- | :------------ |
| `POST` | `/api/auth/register`      | Register new user account            | Public        |
| `POST` | `/api/auth/login`         | Authenticate user & return JWT       | Public        |
| `GET`  | `/api/auth/profile`       | Retrieve active user profile         | Authenticated |
| `GET`  | `/api/locations`          | List all locations                   | Authenticated |
| `GET`  | `/api/menus`              | List menus with stats                | Admin / Staff |
| `POST` | `/api/orders`             | Create an order with balance payment | Authenticated |
| `POST` | `/api/transactions/topup` | Top-up account balance               | Authenticated |
| `GET`  | `/api/dashboard/overview` | Dashboard analytics stats            | Admin / Staff |

---

## License

ISC License.
