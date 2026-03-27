# RCB-Emmvee Project Knowledge Base

## Project Overview

**Project Name:** RCB Ticket App (RCB-Emmvee)  
**Version:** 1.0.0  
**Type:** IPL Ticket Lottery System  
**Tech Stack:** Node.js, Express.js, Vanilla JavaScript, HTML, CSS  
**Data Storage:** CSV files (no database)

### Purpose
A web application for managing IPL ticket distribution for RCB (Royal Challengers Bangalore) matches. The system allows employees to express interest in tickets and administrators to conduct fair lottery draws.

---

## Architecture

### Technology Stack
- **Backend:** Node.js with Express.js (v4.19.2)
- **Frontend:** Static HTML/CSS/JavaScript (no framework)
- **Data Storage:** CSV files
- **Session Management:** In-memory sessions (Map-based)
- **Containerization:** Docker (Node 20 Alpine)

### Project Structure
```
RCB-Emmvee/
├── server.js                 # Main Express server
├── package.json              # Dependencies and scripts
├── Dockerfile                # Container configuration
├── data/                     # CSV data files
│   ├── employees.csv         # Employee master list
│   ├── admins.csv           # Admin credentials
│   ├── interests.csv        # Employee ticket interests
│   └── winners/             # Winner CSVs per match
├── src/
│   ├── matches.js           # Match definitions and utilities
│   └── csv/
│       └── csv.js           # CSV read/write utilities
└── public/
    ├── employee/            # Employee portal (login, form, submitted)
    │   ├── login.html
    │   ├── form.html
    │   ├── submitted.html
    │   └── styles.css
    └── admin/               # Admin portal (login, matches, winners)
        ├── login.html
        ├── matches.html
        ├── match.html
        ├── winners.html
        └── styles.css
```

---

## Core Features

### Employee Portal
1. **Login:** Employee ID-based authentication
2. **Interest Submission:** Select matches and ticket count (1 or 2)
3. **One-time Submission:** Employees can only submit once
4. **Match Selection:** Choose from 5 RCB home matches in Bengaluru

### Admin Portal
1. **Login:** Username/password authentication
2. **Match Dashboard:** View all matches with interest statistics
3. **Lottery Draw:** Conduct fair random draws with capacity limits
4. **Winner Management:** View and download winner lists
5. **Eligibility Tracking:** Employees can only win once across all matches

---

## Data Models

### CSV Files

#### employees.csv
```csv
employeeId,name,email
```
- **employeeId:** Unique identifier for employee
- **name:** Employee name
- **email:** Employee email address

#### admins.csv
```csv
username,password
```
- **username:** Admin username
- **password:** Plain text password (for simplicity)

#### interests.csv
```csv
employeeId,ticketCount,matchId,submittedAt
```
- **employeeId:** Employee who submitted interest
- **ticketCount:** Number of tickets requested (1 or 2)
- **matchId:** Match identifier (e.g., RCB_BLR_1)
- **submittedAt:** ISO timestamp of submission

#### winners/{matchId}.csv
```csv
matchId,employeeId,ticketCount,pickedAt,capacityTickets
```
- **matchId:** Match identifier
- **employeeId:** Winner employee ID
- **ticketCount:** Tickets allocated to winner
- **pickedAt:** ISO timestamp of draw
- **capacityTickets:** Total capacity for the draw

---

## API Endpoints

### Public Endpoints

#### GET /api/matches
Returns list of all available matches.

**Response:**
```json
{
  "matches": [
    {
      "matchId": "RCB_BLR_1",
      "title": "RCB Match 1 (Bengaluru)",
      "dateTime": "TBD",
      "venue": "Bengaluru"
    }
  ]
}
```

### Employee Endpoints

#### POST /api/employee/login
Authenticate employee and create session.

**Request:**
```json
{
  "employeeId": "EMP001"
}
```

**Response:**
```json
{
  "ok": true,
  "employeeId": "EMP001"
}
```

**Errors:**
- `EMPLOYEE_ID_REQUIRED` (400)
- `INVALID_EMPLOYEE_ID` (401)
- `ALREADY_SUBMITTED` (409)

#### GET /api/me
Get current authenticated employee info (requires auth).

**Response:**
```json
{
  "employeeId": "EMP001"
}
```

#### GET /api/employee/submission-status
Check if employee has already submitted (requires auth).

**Response:**
```json
{
  "submitted": true
}
```

#### POST /api/interests
Submit ticket interests (requires auth).

**Request:**
```json
{
  "ticketCount": 2,
  "matchIds": ["RCB_BLR_1", "RCB_BLR_3"]
}
```

**Response:**
```json
{
  "ok": true
}
```

**Errors:**
- `INVALID_TICKET_COUNT` (400)
- `NO_MATCH_SELECTED` (400)
- `INVALID_MATCH_ID` (400)
- `ALREADY_SUBMITTED` (409)

### Admin Endpoints

#### POST /api/admin/login
Authenticate admin and create session.

**Request:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "ok": true,
  "username": "admin"
}
```

**Errors:**
- `USERNAME_PASSWORD_REQUIRED` (400)
- `INVALID_ADMIN_CREDENTIALS` (401)

#### GET /api/admin/matches
Get all matches with statistics (requires admin auth).

**Response:**
```json
{
  "matches": [
    {
      "matchId": "RCB_BLR_1",
      "title": "RCB Match 1 (Bengaluru)",
      "dateTime": "TBD",
      "venue": "Bengaluru",
      "interestedCount": 50,
      "eligibleCount": 45,
      "winnersGenerated": true
    }
  ]
}
```

#### GET /api/admin/matches/:matchId/eligible
Get eligible employees for a specific match (requires admin auth).

**Response:**
```json
{
  "match": { "matchId": "RCB_BLR_1", ... },
  "eligible": [
    {
      "employeeId": "EMP001",
      "ticketCount": 2,
      "submittedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### POST /api/admin/matches/:matchId/draw
Conduct lottery draw for a match (requires admin auth).

**Request:**
```json
{
  "capacityTickets": 100
}
```

**Response:**
```json
{
  "ok": true,
  "match": { "matchId": "RCB_BLR_1", ... },
  "capacityTickets": 100,
  "winners": [
    {
      "employeeId": "EMP001",
      "ticketCount": 2
    }
  ],
  "remainingTickets": 0
}
```

**Errors:**
- `MATCH_NOT_FOUND` (404)
- `INVALID_CAPACITY` (400)
- `WINNERS_ALREADY_GENERATED` (400)

#### GET /api/admin/matches/:matchId/winners
Get winners for a specific match (requires admin auth).

**Response:**
```json
{
  "match": { "matchId": "RCB_BLR_1", ... },
  "winners": [
    {
      "employeeId": "EMP001",
      "ticketCount": 2,
      "pickedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### GET /api/admin/matches/:matchId/winners/download
Download winners CSV file (requires admin auth).

**Response:** CSV file download

### Common Endpoints

#### POST /api/logout
Logout and clear session (employee or admin).

**Response:**
```json
{
  "ok": true
}
```

---

## Business Logic

### Lottery Draw Algorithm

1. **Eligibility Check:**
   - Employee must have submitted interest for the match
   - Employee must not have won any previous match
   - Ticket count must be 1 or 2

2. **Random Selection:**
   - Eligible employees are shuffled randomly using `crypto.randomInt()`
   - Fisher-Yates shuffle algorithm for fairness

3. **Allocation:**
   - Iterate through shuffled list
   - Allocate tickets up to requested count or remaining capacity
   - Stop when capacity is reached

4. **One Winner Per Employee:**
   - Once an employee wins any match, they are excluded from all future draws
   - Checked via `getAllWinnerEmployeeIds()` function

### Session Management

- **In-Memory Storage:** Sessions stored in Map objects (not persistent)
- **Token Generation:** 24-byte random hex tokens via `crypto.randomBytes()`
- **Cookie-based:** HttpOnly cookies for security
- **Separate Sessions:** Different session stores for employees and admins

### CSV Utilities

#### Write Lock Mechanism
- Sequential write operations using promise chain
- Prevents race conditions and data corruption
- Implemented in `src/csv/csv.js`

#### CSV Parsing
- Custom parser supporting quoted fields and commas
- Handles escaped quotes (`""`)
- No external dependencies

---

## Security Considerations

### Current Implementation
- **No Password Hashing:** Admin passwords stored in plain text
- **No HTTPS:** HTTP only (should use reverse proxy in production)
- **In-Memory Sessions:** Lost on server restart
- **No Rate Limiting:** Vulnerable to brute force
- **No CSRF Protection:** Should add tokens for state-changing operations

### Recommendations for Production
1. Hash admin passwords (bcrypt)
2. Use HTTPS with TLS certificates
3. Implement persistent session storage (Redis)
4. Add rate limiting middleware
5. Implement CSRF tokens
6. Add input validation and sanitization
7. Implement audit logging
8. Add file upload size limits

---

## Deployment

### Local Development
```bash
npm install
npm start
# Server runs on http://localhost:3000
```

### Docker Deployment
```bash
docker build -t rcb-ticket-app .
docker run -p 3000:3000 -v $(pwd)/data:/app/data rcb-ticket-app
```

### Environment Variables
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (production/development)

### Data Persistence
- Mount `/app/data` volume to persist CSV files
- Ensure proper file permissions for CSV operations

---

## Match Configuration

### Current Matches
Defined in `src/matches.js`:
- RCB_BLR_1: RCB Match 1 (Bengaluru)
- RCB_BLR_2: RCB Match 2 (Bengaluru)
- RCB_BLR_3: RCB Match 3 (Bengaluru)
- RCB_BLR_4: RCB Match 4 (Bengaluru)
- RCB_BLR_5: RCB Match 5 (Bengaluru)

### Adding New Matches
Edit `src/matches.js` and add to MATCHES array:
```javascript
{
  matchId: "RCB_BLR_6",
  title: "RCB Match 6 (Bengaluru)",
  dateTime: "2024-04-15 19:30",
  venue: "Bengaluru"
}
```

---

## Frontend Implementation

### Employee Portal Flow
1. **login.html:** Employee ID input → POST /api/employee/login
2. **form.html:** Match selection + ticket count → POST /api/interests
3. **submitted.html:** Confirmation page

### Admin Portal Flow
1. **login.html:** Username/password → POST /api/admin/login
2. **matches.html:** Dashboard showing all matches
3. **match.html:** Individual match details + draw functionality
4. **winners.html:** Winner list display + CSV download

### Styling
- Custom CSS (no frameworks)
- Responsive design
- RCB brand colors (red/black theme)

---

## Common Development Tasks

### Add New Employee
Edit `data/employees.csv`:
```csv
employeeId,name,email
EMP001,John Doe,john@example.com
```

### Add New Admin
Edit `data/admins.csv`:
```csv
username,password
admin,admin123
```

### Reset Lottery for a Match
Delete the corresponding file in `data/winners/`:
```bash
rm data/winners/RCB_BLR_1.csv
```

### View All Interests
```bash
cat data/interests.csv
```

### Backup Data
```bash
tar -czf backup-$(date +%Y%m%d).tar.gz data/
```

---

## Troubleshooting

### Server Won't Start
- Check if port 3000 is already in use
- Verify Node.js version (requires Node 20+)
- Ensure data directory has write permissions

### Employee Can't Login
- Verify employeeId exists in `data/employees.csv`
- Check if employee already submitted (can only submit once)
- Clear browser cookies and try again

### Admin Can't Login
- Verify credentials in `data/admins.csv`
- Check for whitespace in username/password
- Clear browser cookies

### Draw Fails
- Ensure capacity is a positive number
- Check if winners already generated for match
- Verify eligible employees exist

### CSV Corruption
- Check file encoding (should be UTF-8)
- Verify CSV format (proper headers)
- Restore from backup if needed

---

## Testing Checklist

### Employee Flow
- [ ] Login with valid employee ID
- [ ] Login with invalid employee ID (should fail)
- [ ] Submit interest with 1 ticket
- [ ] Submit interest with 2 tickets
- [ ] Try to submit twice (should fail)
- [ ] Select multiple matches
- [ ] Logout and verify session cleared

### Admin Flow
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should fail)
- [ ] View matches dashboard
- [ ] View eligible employees for a match
- [ ] Conduct lottery draw
- [ ] Try to draw twice for same match (should fail)
- [ ] View winners list
- [ ] Download winners CSV
- [ ] Logout and verify session cleared

### Edge Cases
- [ ] Employee wins one match, verify excluded from future draws
- [ ] Draw with capacity less than interested employees
- [ ] Draw with capacity greater than interested employees
- [ ] Submit interest for invalid match ID
- [ ] Concurrent submissions (race conditions)

---

## Performance Considerations

### Current Limitations
- In-memory sessions (single process only)
- CSV file I/O on every request
- No caching mechanism
- Linear search through CSV data

### Scalability Recommendations
1. Use database (PostgreSQL/MongoDB) instead of CSV
2. Implement Redis for session storage
3. Add caching layer (Redis/Memcached)
4. Use connection pooling
5. Implement horizontal scaling with load balancer
6. Add CDN for static assets

---

## Code Style & Conventions

### JavaScript
- ES6+ syntax
- Async/await for asynchronous operations
- Functional programming patterns
- No semicolons (ASI)
- 2-space indentation

### Error Handling
- Consistent error codes (uppercase snake_case)
- HTTP status codes: 400 (bad request), 401 (unauthorized), 404 (not found), 409 (conflict)
- Try-catch blocks for async operations

### Naming Conventions
- camelCase for variables and functions
- UPPER_CASE for constants
- PascalCase for classes (not used in this project)
- Descriptive names (no abbreviations)

---

## Future Enhancements

### Planned Features
- [ ] Email notifications for winners
- [ ] SMS notifications
- [ ] Employee dashboard showing submission status
- [ ] Admin analytics and reporting
- [ ] Multi-venue support
- [ ] Waitlist management
- [ ] Ticket transfer functionality
- [ ] QR code generation for tickets

### Technical Improvements
- [ ] Database migration (PostgreSQL)
- [ ] Authentication with JWT
- [ ] Password hashing (bcrypt)
- [ ] Input validation library (Joi/Zod)
- [ ] API documentation (Swagger)
- [ ] Unit tests (Jest)
- [ ] Integration tests (Supertest)
- [ ] CI/CD pipeline
- [ ] Monitoring and logging (Winston/Pino)
- [ ] Rate limiting (express-rate-limit)

---

## Dependencies

### Production
- **express** (^4.19.2): Web framework

### Dev Dependencies
None (minimal dependencies approach)

### Built-in Node Modules Used
- `path`: File path utilities
- `crypto`: Random token generation and shuffling
- `fs/promises`: Async file operations

---

## License & Credits

**Project:** RCB-Emmvee  
**Organization:** Emmvee (assumed)  
**Purpose:** Internal employee ticket lottery system  
**License:** Private/Proprietary

---

## Quick Reference

### Start Server
```bash
npm start
```

### Access URLs
- Employee Portal: http://localhost:3000/employee/login.html
- Admin Portal: http://localhost:3000/admin/login.html
- API Base: http://localhost:3000/api

### Important Files
- Server: `server.js`
- Matches: `src/matches.js`
- CSV Utils: `src/csv/csv.js`
- Employee Data: `data/employees.csv`
- Admin Data: `data/admins.csv`
- Interests: `data/interests.csv`
- Winners: `data/winners/*.csv`

### Key Functions
- `requireEmployee()`: Employee auth middleware
- `requireAdmin()`: Admin auth middleware
- `getAllWinnerEmployeeIds()`: Get all past winners
- `shuffleInPlace()`: Fisher-Yates shuffle
- `readCsv()`: Parse CSV file
- `rewriteCsv()`: Write CSV file with lock
