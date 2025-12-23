# LinkedIn Outreach Extension API Documentation

This document describes the API endpoints for the browser extension that enables automated LinkedIn outreach.

## Base URL

```
https://efdvolifacsnmiinifiq.supabase.co/functions/v1/linkedin-extension-api
```

## Authentication

All requests must include a valid Supabase JWT token in the Authorization header:

```
Authorization: Bearer <supabase_access_token>
```

The extension should get this token by:
1. User logs into the CRM web app
2. Extension receives the session token via secure messaging
3. Extension stores and uses the token for API calls

## Endpoints

### 1. Get Next Profile

Fetches the next LinkedIn profile to visit from the active campaign queue.

**Request:**
```
GET ?action=get-next-profile
```

**Response:**
```json
{
  "profile": {
    "id": "uuid",
    "campaign_id": "uuid",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "first_name": "John",
    "job_title": "Software Engineer",
    "company": "Acme Inc",
    "status": "in_progress",
    "position": 0
  },
  "campaign": {
    "id": "uuid",
    "name": "Q1 Developer Outreach",
    "outreach_mode": "connect_with_note",
    "custom_message": "Hi {first_name}, I noticed you work at {company}...",
    "daily_limit": 20,
    "visited_today": 5,
    "sent_today": 3
  }
}
```

**Response when no more profiles:**
```json
{
  "profile": null,
  "message": "Campaign completed - no more profiles"
}
```

**Response when daily limit reached:**
```json
{
  "profile": null,
  "message": "Daily limit reached",
  "daily_limit": 20,
  "visited_today": 20
}
```

---

### 2. Report Visit Result

Reports the result of visiting a LinkedIn profile.

**Request:**
```
POST ?action=report-visit
Content-Type: application/json

{
  "queue_item_id": "uuid",
  "status": "visited" | "connected" | "skipped" | "error",
  "dwell_time_seconds": 45,
  "connection_sent": true,
  "error_message": null,
  "skip_reason": null
}
```

**Status values:**
- `visited` - Profile was viewed but no action taken
- `connected` - Connection request was sent
- `skipped` - Profile was skipped (already connected, premium required, etc.)
- `error` - An error occurred

**Response:**
```json
{
  "success": true
}
```

---

### 3. Get Campaign Status

Gets the status of all active/paused campaigns for the user.

**Request:**
```
GET ?action=get-status
```

**Response:**
```json
{
  "campaigns": [
    {
      "id": "uuid",
      "name": "Q1 Developer Outreach",
      "status": "active",
      "daily_limit": 20,
      "visited_today": 5,
      "sent_today": 3,
      "locked_until": null,
      "total_profiles": 100,
      "pending_count": 85,
      "completed_count": 15
    }
  ]
}
```

---

### 4. Pause Campaign

Pauses an active campaign.

**Request:**
```
POST ?action=pause-campaign
Content-Type: application/json

{
  "campaign_id": "uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

---

### 5. Resume Campaign

Resumes a paused campaign.

**Request:**
```
POST ?action=resume-campaign
Content-Type: application/json

{
  "campaign_id": "uuid"
}
```

**Response:**
```json
{
  "success": true
}
```

---

## Extension Flow

### 1. Initial Setup
1. User installs Chrome extension
2. User logs into CRM web app
3. CRM sends session token to extension via `chrome.runtime.sendMessage`
4. Extension stores token securely

### 2. Campaign Execution Loop
```
while (campaign is active) {
  1. Call GET ?action=get-next-profile
  2. If no profile, check if daily limit or campaign complete
  3. Navigate to LinkedIn profile URL
  4. Wait random 30-90 seconds (human-like dwell time)
  5. If outreach_mode === "connect_with_note":
     - Click "Connect" button
     - Click "Add a note"
     - Fill in personalized message (replace {first_name}, {company}, etc.)
     - Click "Send"
  6. Else if outreach_mode === "connect_without_note":
     - Click "Connect" button
     - Click "Send without note"
  7. Call POST ?action=report-visit with result
  8. Wait random 60-180 seconds before next profile
  9. Repeat
}
```

### 3. Safety Features
- Daily limit enforced server-side (max 35)
- Campaign auto-locks when daily limit reached
- Human-like delays between actions
- Extension respects LinkedIn's DOM changes
- Graceful error handling and retry logic

---

## Message Personalization

The extension should replace these variables in the custom_message:

| Variable | Description |
|----------|-------------|
| `{first_name}` | Profile's first name |
| `{job_title}` | Current job title |
| `{company}` | Current company name |

**Example:**
```
Template: "Hi {first_name}, I noticed you work at {company} as a {job_title}..."
Result:   "Hi John, I noticed you work at Acme Inc as a Software Engineer..."
```

---

## Error Handling

The extension should handle these scenarios:

1. **Profile not found**: Skip and report `status: "error"`
2. **Already connected**: Skip and report `status: "skipped"` with `skip_reason: "already_connected"`
3. **InMail only**: Skip and report `status: "skipped"` with `skip_reason: "inmail_required"`
4. **Rate limited by LinkedIn**: Pause campaign and retry after 1 hour
5. **Session expired**: Prompt user to re-authenticate

---

## Security Notes

1. Extension only runs in the user's browser with their logged-in LinkedIn session
2. No LinkedIn credentials are stored or transmitted
3. All actions are performed by the user's browser
4. Daily limits cannot be bypassed client-side
5. Campaign data is tenant-isolated via RLS
