# Krewby — Workforce Scheduling & Smart Assignment

A React frontend application for workforce scheduling, built from wireframes.

## Features

- **Login screen** — demo auth (any email/password)
- **Dashboard** — shift overview, pending requests, workload balance, notifications
- **Schedule** — week grid with Morning / Afternoon / Evening shift blocks
- **Smart Assign** — AI-ranked staff recommendations with score bars
- **Staff Management** — searchable/filterable staff list with skills and status
- **Approval Queue** — Approve/Deny leave, swap, and replacement requests
- **Krewby Requests** — External casual worker requests with AI matching
- **AI Assistant** — Live Claude API chat for workforce queries
- **Reports & Attendance** — KPIs, daily attendance, Krewby usage stats
- **My Schedule** (Staff view) — upcoming shifts, swap requests, leave submission
- **My Availability** (Staff view) — interactive weekly availability grid

## Role Switching

The top tabs switch between three views:
- **Outlet Manager** — full management access
- **Staff View** — employee-facing screens
- **Krewby Coordinator** — external worker coordination

---

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The app opens at **http://localhost:3000**

### Build for Production

```bash
npm run build
```

Output goes to the `build/` folder — deploy it to any static host (Netlify, Vercel, S3, etc).

---

## Project Structure

```
krewby/
├── public/
│   └── index.html              # HTML shell + CDN links
├── src/
│   ├── index.js                # React entry point
│   ├── index.css               # Global styles & CSS variables
│   ├── App.jsx                 # Root component — routing & role state
│   ├── data/
│   │   └── mockData.js         # All mock data, nav config, schedule data
│   ├── components/
│   │   ├── Badge.jsx           # Colored status pill
│   │   ├── Button.jsx          # Primary / secondary / approve / deny buttons
│   │   ├── Card.jsx            # Card + CardHeader wrapper
│   │   ├── MiniAvatar.jsx      # Small circular avatar with initials
│   │   ├── ScoreBar.jsx        # Labeled score bar (Smart Assign)
│   │   ├── Sidebar.jsx         # Left nav sidebar
│   │   └── Topbar.jsx          # Role tabs + page title + action icons
│   └── screens/
│       ├── Login.jsx           # Login screen
│       ├── Dashboard.jsx       # Manager dashboard
│       ├── Schedule.jsx        # Week grid schedule
│       ├── SmartAssign.jsx     # AI staff recommendation screen
│       ├── StaffManagement.jsx # Staff list with search/filter
│       ├── ApprovalQueue.jsx   # Leave/swap/replacement approvals
│       ├── KrewbyRequests.jsx  # External worker request screen
│       ├── AIAssistant.jsx     # AI chat (Claude API)
│       ├── Reports.jsx         # Reports & attendance
│       ├── MySchedule.jsx      # Staff: my upcoming shifts
│       └── Availability.jsx    # Staff: weekly availability grid
```

---

## AI Assistant

The AI Assistant screen calls the **Anthropic Claude API** directly from the browser.

> ⚠️ For production, move API calls to a backend server to protect your API key.

The system prompt instructs Claude to act as a read-only workforce assistant scoped to scheduling, shift coverage, workload, and leave data.

---

## Customisation

### Colors

All colors are CSS variables in `src/index.css`:

```css
:root {
  --accent: #2C2C2A;   /* Sidebar + buttons */
  --blue:   #E6F1FB;   /* Morning shifts, info badges */
  --green:  #EAF3DE;   /* Afternoon shifts, success */
  --amber:  #FAEEDA;   /* Evening shifts, warnings */
  --red:    #FCEBEB;   /* Conflicts, errors */
  --purple: #EEEDFE;   /* Krewby, AI features */
}
```

### Mock Data

All fixture data lives in `src/data/mockData.js` — staff, schedule, recommendations, approvals, availability, workload.

### Adding Screens

1. Create `src/screens/YourScreen.jsx`
2. Import it in `src/App.jsx`
3. Add a `case 'yourscreen':` to `renderScreen()`
4. Add a nav entry to the relevant nav array in `mockData.js`
