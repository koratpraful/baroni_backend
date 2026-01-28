Live Show API – Frontend Reference
Base path: /api/live-shows
Auth: all routes require a valid auth token (router.use(requireAuth))


1. Create live show (star only)
URL: POST /api/live-shows
Auth role: star
Body (form-data or JSON):
sessionTitle (string, required)
date (ISO 8601 string, required – e.

g. "2026-02-05T00:00:00.000Z")
time (string, required – e.

g. "20:30")
attendanceFee (number, required, ≥ 0)
hostingPrice (number, required, ≥ 0)
maxCapacity (optional: "unlimited" or positive number as string)
description (optional string, max 500 chars)
thumbnail:
Either thumbnail as URL (string), OR
File upload: thumbnail file field (image buffer)
starName (optional helper field for payment description)
contact (phone, required for hybrid payment)
Behavior:
Validates date rules (from tomorrow unless LIVESHOW_TODAY=true).
Creates hybrid transaction for hosting fee to admin.
Creates LiveShow with:
status: 'pending'
paymentStatus: 'initiated' | 'pending'
Sends notifications to admin and star.
Response (201):
{ success: true, message, data: { liveShow, count: 1, [externalPaymentMessage?] } }
liveShow is sanitized: id, sessionTitle, date, time, attendanceFee, hostingPrice, maxCapacity, thumbnail, showCode, inviteLink, status, paymentStatus, createdAt, updatedAt, etc.


2. Get all live shows (for listing/home)
URL: GET /api/live-shows
Auth role: any authenticated user (fan/star/admin)
Query params:
status (optional): one of pending | completed | cancelled
starId (optional): Mongo ID to filter by star
upcoming (optional): "true" to get only future pending shows
When upcoming=true:
date > now
status = 'pending' (overwrites any other status)
Response:
{ success: true, message, data: [ ...items ] }
Each item includes:
Show info (id, sessionTitle, date, time, attendanceFee, maxCapacity, currentAttendees, thumbnail, showCode, status, description, etc.)
Flags like isUpcoming, isLiked, isFavorite, hasJoined, likeCount, likescount
Computed fields: showAt (ISO date), timeToNowMs
> For “upcoming” tab: call GET /api/live-shows?upcoming=true and filter on isUpcoming or just rely on returned order (future shows first).


3. Get live show by ID
URL: GET /api/live-shows/:id
Auth role: any authenticated user
Response:
{ success: true, message, data: { liveShow } }
liveShow has user-specific flags (isFavorite, hasJoined, isLiked, isUpcoming).


4. Get live show by code
URL: GET /api/live-shows/code/:showCode
Auth role: any authenticated user
Usage: when user enters a show code; backend uppercases showCode.


5. Get detailed fan view (with countdown)
URL: GET /api/live-shows/:id/details
Auth role: fan (or any logged-in user)
Behavior:
Fails if show is completed or cancelled or date <= now.
Calculates countdown: "HH:MM until live".
Includes attendance info for this fan.
Response:
data includes:
id, sessionTitle, formatted date and time
timeUntilLive (string), attendanceFee, maxCapacity, currentAttendees
showCode, inviteLink, status, paymentStatus
description, thumbnail
isJoined, attendanceStatus, attendancePaymentStatus
Embedded star details and attendance summary.


6. Get star’s upcoming shows (public star profile)
URL: GET /api/live-shows/star/:starId/upcoming
Auth role: any authenticated user
Behavior:
Filters: starId, status='pending', date > now.
Response:
{ success: true, data: { liveShows: [...] } }
Each element has isUpcoming, isLiked, hasJoined, etc.
> For star profile “Upcoming Lives” section: this is the recommended endpoint.


7. Get all shows for a star
URL: GET /api/live-shows/star/:starId
Auth role: any authenticated user
Query:
status (optional): pending | completed | cancelled
Response:
{ success: true, data: { liveShows: [...] } }
Sorted by date descending.


8. Get my joined shows (fan only)
URL: GET /api/live-shows/me/joined
Auth role: fan
Behavior:
Returns shows where attendees includes req.user._id.
Sorted by date desc.
Response:
{ success: true, data: [...] }


9. Get my shows (role-aware)
URL: GET /api/live-shows/me/shows
Auth role: fan or star
Query:
status (optional): pending | completed | cancelled
upcoming (optional): "true" → adds date > now and forces status='pending'.
Behavior:
If role === 'fan': shows the shows that user has joined.
If role === 'star': shows the shows that user has hosted.
Response:
{ success: true, data: [...], role, count }
> For star’s “My Upcoming Live Shows” screen:
> GET /api/live-shows/me/shows?upcoming=true (as star).
1

0. Entertainment feed (events + live shows + ads)
URL: GET /api/live-shows/feed
Auth role: any authenticated user
Behavior:
For fans:
All pending upcoming live shows (status='pending', date ≥ now) + events + ads.
For stars:
Their own live shows OR shows they joined, plus events + ads.
Returns mixed array sorted by time, with type:
type: 'live_show' | 'event' | 'ad'
Response:
{ success: true, data: [ { type, startAt, payload: {...} }, .

.. ] }
1

1. Update live show (star/admin)
URL: PUT /api/live-shows/:id
Auth role: star or admin
Body:
Any subset of sessionTitle, date, time, attendanceFee, hostingPrice, maxCapacity, description, thumbnail (URL or file).
Rules:
Only star who created show or admin can update.
maxCapacity='unlimited' → stored as -1.
Response:
{ success: true, data: { liveShow } }
1

2. Delete live show
URL: DELETE /api/live-shows/:id
Auth role: star or admin
Behavior:
Only owner star or admin can delete.
Response:
{ success: true, message }
1

3. Like / Unlike live show
URL: POST /api/live-shows/:id/like
Auth role: any authenticated user
Behavior:
Toggles like; if already liked → unlike; else like.
Response:
{ success: true, message: 'Liked' | 'Unliked', data: { ...liveShow, likeCount } }
1

4. Join live show (fan)
URL: POST /api/live-shows/:id/join
Auth role: fan or admin
Body:
contact (phone, required if attendanceFee > 0)
starName (optional for descriptions)
Behavior:
Only allowed when status='pending' and capacity not full.
Creates hybrid transaction for attendance (if fee > 0).
Creates/updates LiveShowAttendance.
Adds user to attendees, increments currentAttendees.
Response:
{ success: true, message, data: { ...showWithFlags }, [externalPaymentMessage?] }
1

5. Cancel live show (star)
URL: PATCH /api/live-shows/:id/cancel
Auth role: star or admin
Behavior:
Cancels all pending attendance transactions and marks them cancelled.
Sets show status='cancelled'.
Sends cancellation notifications.
Response:
{ success: true, message, data: { liveShow } }
1

6. Reschedule live show (star)
URL: PATCH /api/live-shows/:id/reschedule
Auth role: star or admin
Body:
date (optional ISO 8601)
time (optional string)
Behavior:
Only owner star or admin.
Updates date/time and notifies attendees.
Response:
{ success: true, message, data: { liveShow } }
1

7. Complete attendance (after live ends)
URL: POST /api/live-shows/:id/complete-attendance
Auth role: star or admin
Behavior:
Completes all pending attendance transactions (coins → star).
Marks show status='completed'.
Optionally cleans up messaging between star and attendees.
Response:
{ success: true, message }
1

8. Get Agora token for live (star/admin)
URL: GET /api/live-shows/:id/agora-token
Auth role: star or admin
Behavior:
Only star who created the show or admin.
channelName = "live_show_<id>".
Uses user’s Agora key to generate RTC token.
Response:
{ success: true, data: { token, channelName, uid, liveShowId } }