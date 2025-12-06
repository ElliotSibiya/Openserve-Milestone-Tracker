# OpenServe Milestone Tracker

A multi-user web application for OpenServe to track fiber project milestones and deadlines. This application calculates deadlines using **business days only** (excluding weekends and South African public holidays).

## Features

- **Multi-user system** with three role levels: Staff, Admin, and Super Admin
- **Project management** with 12 phases from Site Survey to COM
- **Business day calculations** excluding SA public holidays
- **In-app notification system** for deadline warnings
- **Role-based permissions** for viewing, editing, and managing projects

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Zustand
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite with Prisma ORM
- **Authentication**: JWT with httpOnly cookies

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Install all dependencies:
```bash
npm run install:all
```

2. Set up the database:
```bash
npm run db:migrate
```

3. Seed the database (creates Super Admin account):
```bash
npm run db:seed
```

4. Start the development servers:
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Default Super Admin Account

- **Email**: admin@openserve.co.za
- **Password**: Admin@123

## Project Structure

```
openserve-tracker/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── store/          # Zustand state stores
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   └── ...
├── server/                 # Express backend
│   ├── src/
│   │   ├── routes/         # API route handlers
│   │   ├── middleware/     # Express middleware
│   │   └── utils/          # Utility functions
│   └── prisma/
│       ├── schema.prisma   # Database schema
│       └── seed.ts         # Database seeder
└── ...
```

## User Roles

### Staff
- View all projects
- Create new projects
- Mark phases as complete

### Admin/Manager
- Everything Staff can do
- Edit project details and phase allowed days
- Delete projects
- Manage users (add/remove staff)

### Super Admin
- Everything Admin can do
- Change global default "Allowed Days" values
- Promote/demote Admins

## Project Phases

1. **Planning** (default: 10 days)
2. **Funding** (default: 2 days)
3. **Wayleave** (default: 20 days) - Optional, set to 0 to skip
4. **Materials** (default: 15 days)
5. **Announcement** (default: 1 day)
6. **Kick-Off** (default: 2 days)
7. **Build** (default: 20 days)
8. **FQA** - Mirrors Build deadline
9. **ECC** (default: 1 day)
10. **Integration** (default: 2 days)
11. **RFA** (default: 1 day)
12. **COM** - Mirrors RFA deadline

## South African Public Holidays

The system excludes the following public holidays:
- New Year's Day (1 January)
- Human Rights Day (21 March)
- Good Friday (calculated)
- Family Day (day after Good Friday)
- Freedom Day (27 April)
- Workers' Day (1 May)
- Youth Day (16 June)
- National Women's Day (9 August)
- Heritage Day (24 September)
- Day of Reconciliation (16 December)
- Christmas Day (25 December)
- Day of Goodwill (26 December)

**Note**: If a public holiday falls on a Sunday, the following Monday is observed.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create project
- `PATCH /api/projects/:id` - Update project (Admin+)
- `DELETE /api/projects/:id` - Delete project (Admin+)

### Phases
- `POST /api/phases/:id/complete` - Mark phase complete
- `POST /api/phases/:id/uncomplete` - Unmark phase (Admin+)

### Users (Admin+)
- `GET /api/users` - List all users
- `PATCH /api/users/:id/role` - Change user role
- `DELETE /api/users/:id` - Delete user

### Settings (Super Admin only)
- `GET /api/settings` - Get global defaults
- `PATCH /api/settings` - Update global defaults

### Notifications
- `GET /api/notifications` - Get user's notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `POST /api/notifications/read-all` - Mark all as read

## Environment Variables

Create a `.env` file in the `server` directory:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3001
NODE_ENV=development
SUPER_ADMIN_EMAIL="admin@openserve.co.za"
SUPER_ADMIN_PASSWORD="your-secure-password"
```

## License

Proprietary - OpenServe
