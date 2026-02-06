# Web-Mobile Messaging System Integration Guide

## Overview
Complete bidirectional messaging system between web and mobile applications with real-time updates.

## Database Schema

```sql
CREATE TABLE "Message" (
    "id" SERIAL PRIMARY KEY,
    "senderId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "recipientId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN DEFAULT false,
    "readAt" TIMESTAMP,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");
CREATE INDEX "Message_recipientId_idx" ON "Message"("recipientId");
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");
```

## API Endpoints

All endpoints require JWT authentication via `Authorization: Bearer {token}` header.

### 1. Send Message
**POST** `/api/messages`

Request body:
```json
{
  "recipientId": 2,
  "content": "Merhaba, bu bir test mesajıdır"
}
```

Response (201):
```json
{
  "id": 1,
  "senderId": 1,
  "recipientId": 2,
  "content": "Merhaba, bu bir test mesajıdır",
  "isRead": false,
  "readAt": null,
  "createdAt": "2026-02-04T18:30:00.000Z",
  "sender": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "recipient": {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com"
  }
}
```

### 2. Get Messages with User
**GET** `/api/messages?conversationWith={userId}`

Optional params:
- `unreadOnly=true` - Get only unread messages

Response (200):
```json
{
  "messages": [
    {
      "id": 1,
      "senderId": 1,
      "recipientId": 2,
      "content": "First message",
      "isRead": true,
      "readAt": "2026-02-04T18:31:00.000Z",
      "createdAt": "2026-02-04T18:30:00.000Z",
      "sender": {...},
      "recipient": {...}
    }
  ]
}
```

### 3. Get Conversations List
**GET** `/api/messages/conversations`

Response (200):
```json
{
  "conversations": [
    {
      "partnerId": 2,
      "partnerName": "Jane Smith",
      "partnerEmail": "jane@example.com",
      "lastMessage": "Evet, anladım",
      "lastMessageTime": "2026-02-04T18:45:00.000Z",
      "unreadCount": 2,
      "isRead": false
    }
  ]
}
```

### 4. Mark Messages as Read
**PATCH** `/api/messages/mark-read`

Request body:
```json
{
  "messageIds": [1, 2, 3]
}
```

Response (200):
```json
{
  "updated": 3
}
```

## Web Interface

### Access
- URL: `http://192.168.1.3:3000/messages`
- Navigation: Sidebar → "Mesajlar"

### Features
- **Conversation List**: Shows all conversations with last message preview and unread count
- **Search**: Filter conversations by name or email
- **Chat View**: Full conversation with a selected user
- **Real-time Updates**: Auto-polls every 2 seconds for new messages
- **Read Receipts**: Messages automatically marked as read when opened
- **Auto-scroll**: Scrolls to latest message automatically

### UI Components
- Material-UI for styling
- Lucide icons for visual indicators
- Responsive design for desktop
- Badge notifications for unread messages

## Mobile Interface

### File Location
`/MiraStokMobile/screens/MessagesScreen.tsx`

### Features
- **Dual View**: Conversations list and chat interface
- **Real-time Polling**: 2-second interval for new messages
- **Unread Indicators**: Badge showing unread message count
- **Read Receipts**: Automatic marking as read
- **Search**: Filter conversations by name/email
- **Auto-scroll**: Smooth scrolling to latest message

### Integration
1. Import in app navigation:
```tsx
import MessagesScreen from '../screens/MessagesScreen';

// Add to navigation stack
<Stack.Screen 
  name="Messages" 
  component={MessagesScreen} 
  options={{ title: 'Mesajlar' }}
/>
```

2. Add to bottom tab navigation if needed:
```tsx
<Tab.Screen 
  name="Messages" 
  component={MessagesScreen}
  options={{
    tabBarLabel: 'Mesajlar',
    tabBarIcon: ({ color }) => <MessageCircle color={color} />,
  }}
/>
```

## Implementation Details

### Message Polling Strategy
- Both web and mobile apps poll `/api/messages?conversationWith={userId}` every 2 seconds
- Efficiently gets only messages from specific conversation
- Auto-marks unread messages as read

### Conversation List Optimization
- Fetched once per app load, updates on new message
- Groups messages by conversation partner
- Calculates unread count per conversation
- Sorted by most recent message

### Token Management
- JWT token stored in localStorage (web) or AsyncStorage (mobile)
- Extracted from token payload: `userId`, `email`, `name`
- Used to identify current user for message direction

## Security

### Authentication
- All endpoints require valid JWT token
- Token verified before processing requests
- User context extracted from token payload

### Data Access
- Users can only send messages to existing users
- Users can only read their own received messages
- Recipients validated before message creation
- OnDelete CASCADE ensures clean data removal

### CORS
- API endpoints have CORS headers enabled
- Allows cross-origin requests from mobile apps
- Restricted in production if needed

## Error Handling

### Common Errors
```
401 Unauthorized
- Invalid or missing token
- Token expired

400 Bad Request
- Missing recipientId or content
- Invalid messageIds format

404 Not Found
- Recipient user doesn't exist

500 Server Error
- Database connection issues
- Unexpected server error
```

## Performance Considerations

### Database Indexes
- `senderId` - Fast lookup of sent messages
- `recipientId` - Fast lookup of received messages
- `createdAt` - Efficient sorting by timestamp

### Query Optimization
- Messages limited to 50 per conversation
- Indexed lookups on sender/recipient IDs
- Ordered by creation time for chronological display

### Polling Rate
- 2-second interval balances real-time feel with server load
- Consider WebSocket upgrade for higher frequency updates
- Can be adjusted in component constants if needed

## Future Enhancements

1. **WebSocket Support**
   - Real-time message delivery without polling
   - Reduce server load and network traffic
   - Instant notifications

2. **Message Groups**
   - Group conversations
   - Broadcast messaging to multiple users
   - Department-wide announcements

3. **File Attachments**
   - Support for images, documents, files
   - Virus scanning and file size limits
   - Automatic thumbnail generation

4. **Message Threading**
   - Reply to specific messages
   - Quote functionality
   - Organized conversations

5. **Notification System**
   - Push notifications for new messages
   - Email notifications for offline users
   - Notification preferences per user

6. **Message Reactions**
   - Emoji reactions to messages
   - Reaction counts and lists
   - Quick sentiment indication

## Testing

### API Testing
```bash
# Send message
curl -X POST http://localhost:3000/api/messages \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"recipientId": 2, "content": "Test message"}'

# Get conversations
curl -X GET http://localhost:3000/api/messages/conversations \
  -H "Authorization: Bearer {token}"

# Mark as read
curl -X PATCH http://localhost:3000/api/messages/mark-read \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"messageIds": [1, 2, 3]}'
```

### UI Testing
1. Open web app: http://192.168.1.3:3000/messages
2. Open mobile app
3. Send message from web to user on mobile
4. Verify message appears in mobile app within 2 seconds
5. Send reply from mobile
6. Verify reply appears in web app within 2 seconds
7. Check unread badges update correctly
8. Test search functionality
9. Test message marking as read
