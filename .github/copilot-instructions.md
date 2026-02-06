# Copilot Instructions for fabric-stock

A Next.js + Tauri desktop application for fabric stock management and garment subcontracting (fason) operations.

## Architecture Overview

**Tech Stack**: Next.js 15 + React 19 + Prisma + PostgreSQL + Tauri + TypeScript

**Key Modules**:
- **Stock Management** (`pages/stock.tsx`, `/api/stock/*`) - Fabric inventory tracking
- **Fason (Subcontracting)** (`pages/fason/*`, `/api/fason/*`) - Work order creation, workshop assignments, production tracking
- **Authentication** - JWT-based with role-based access control (admin, stock, fason roles)
- **UI Components** (`components/ui/*`) - Radix UI-based component library with Tailwind CSS

## Critical Patterns

### Authentication & Authorization
- **Token Storage**: JWT tokens stored in `localStorage` as `"token"` key
- **Token Verification**: Extract `Bearer {token}` from `Authorization` header in API routes
- **Standard Pattern**: Use `verifyToken()` helper in API routes (defined in each file or imported from `lib/auth.ts`)
- **User Context**: `AuthContext` in [components/AuthContext.tsx](components/AuthContext.tsx) provides `useAuth()` hook with `user`, `authenticated`, `checkAuth()` methods
- **Fallback Routes**: Login pages (`/login`, `/admin/login`) should bypass `AuthProvider` via public paths array in [pages/_app.tsx](pages/_app.tsx#L28)

### API Route Conventions
- **Pattern**: Switch statement on `req.method` with separate handler functions (`handleGet`, `handlePost`, `handlePut`, `handleDelete`)
- **Token Verification First**: Always wrap route with try-catch calling `verifyToken(req)` before method dispatch
- **Example**: See [pages/api/fason/work-orders/[id].ts](pages/api/fason/work-orders/[id].ts) - validates token, dispatches by method, returns 401 on auth failure
- **Prisma Usage**: Import `prisma` from `@/lib/prisma` (singleton instance) for database queries
- **Error Responses**: Return appropriate HTTP status (400 validation, 401 auth, 404 not found, 500 server error) with `{ error: "message" }` JSON

### Form & Data Patterns
- **Component State Management**: Use `useState` for form data (see [pages/fason/create-work-order.tsx](pages/fason/create-work-order.tsx#L90) - maintains `formData`, `modelInfos` arrays with separate handlers)
- **Input Change Handlers**: Create specific handlers like `handleInputChange()`, `handleDateChange()`, `handleModelChange(index, field, value)` for different field types
- **Validation**: Validate before submit - check required fields, array length, numeric constraints with `alert()` for error messages (Turkish language expected)
- **API Submission**: Use fetch with `Authorization: Bearer ${token}` header; handle both success and failure arrays for batch operations

### UI Component Usage
- **Radix UI Base**: All components in [components/ui/](components/ui/) wrap Radix UI primitives (checkbox, select, tabs, etc.) with Tailwind styling
- **Gradient & Styling**: Use Tailwind gradients (`bg-gradient-to-r from-indigo-600...`) and spacing classes extensively
- **Table Structure**: [Table, TableHeader, TableBody, TableCell, TableHead, TableRow](components/ui/table.tsx) from shadcn/ui for data display
- **Modals**: Use `Dialog` from `@radix-ui/dialog` (wrapped in [components/ui/dialog.tsx](components/ui/dialog.tsx))
- **Language**: UI text is in Turkish (Türkçe) - error messages, labels, button text all use Turkish

### Data Models (Prisma)
- **Core Entities**: Product, Fabric, FabricEntry (giriş), FabricExit (çıkış), Color, User, WorkOrder, Workshop, FasonTracking
- **Relationships**: Use Prisma relations with `@relation()` for foreign keys
- **Timestamps**: All entities include `createdAt` and `updatedAt` DateTime fields
- **Access Control**: User model includes `stockAccess` and `fasonAccess` boolean flags for role-based access
- **See**: [prisma/schema.prisma](prisma/schema.prisma) for all model definitions

## Developer Workflows

### Development & Testing
- **Start Dev Server**: `npm run dev` (launches Next.js dev server on port 3000)
- **Build & Desktop**: `npm run build` (builds Next.js then Tauri desktop app)
- **Linting**: `npm run lint` (ESLint, configured to ignore build errors in `next.config.js`)
- **Testing**: `npm test` (Jest runner), `npm run test:watch` for watch mode
- **Database**: Prisma migrations with `prisma migrate dev`, seeding with `ts-node prisma/seed.ts`

### API Testing
- Test endpoints with `Authorization: Bearer {token}` header
- Use [pages/api/auth/test-login.ts](pages/api/auth/test-login.ts) endpoint for debugging auth flow (verbose logging with emoji indicators)
- Check localStorage token in browser DevTools Console: `localStorage.getItem('token')`

### Mobile Integration
- Fason work orders have `assignedToMobile` flag for mobile app assignment
- Mobile-only endpoints at [pages/api/fason/work-orders/mobile.ts](pages/api/fason/work-orders/mobile.ts) (public, returns only mobile-assigned orders)
- Mobile tracking via [pages/api/fason/tracking.ts](pages/api/fason/tracking.ts) (authenticated, logs production progress)

## Code Examples

### Creating a Protected API Route
```typescript
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const verifyToken = (req: NextApiRequest) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) throw new Error('Token bulunamadı');
  return jwt.verify(token, process.env.JWT_SECRET || 'secret-key');
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user = verifyToken(req);
    switch (req.method) {
      case 'GET':
        return handleGet(req, res, user);
      case 'POST':
        return handlePost(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any) {
  const data = await prisma.yourModel.findMany();
  return res.json(data);
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { field1, field2 } = req.body;
  const result = await prisma.yourModel.create({ data: { field1, field2 } });
  return res.json(result);
}
```

### Form with Validation & Batch Submit
```typescript
const [items, setItems] = useState<ItemType[]>([]);
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  const errors: string[] = [];
  
  // Validate
  items.forEach((item, i) => {
    if (!item.name) errors.push(`Item ${i + 1}: Name required`);
  });
  
  if (errors.length > 0) {
    alert("Errors:\n\n" + errors.join("\n"));
    return;
  }
  
  setLoading(true);
  const success = [];
  const failed = [];
  
  for (const item of items) {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(item)
      });
      
      if (res.ok) {
        success.push(await res.json());
      } else {
        const err = await res.json();
        failed.push(`${item.name}: ${err.error}`);
      }
    } catch (e) {
      failed.push(`${item.name}: Connection error`);
    }
  }
  
  let msg = `${success.length} created successfully!`;
  if (failed.length > 0) msg += `\n\nFailed:\n${failed.join("\n")}`;
  alert(msg);
  setLoading(false);
};
```

## Fason İş Emri Akışı (Workflow)

The Fason module handles subcontracting work orders with a multi-step workflow:

### 1. Model Bilgileri (Model Information) - Creation Phase
Products are added as **models** with pricing and quantity. Each model becomes a separate work order.

**Pattern** (see [pages/fason/create-work-order.tsx](pages/fason/create-work-order.tsx)):
- Maintain `modelInfos: ModelInfo[]` state for dynamic model rows
- Use `handleAddModelInfo()` to add new rows with default values
- Use `handleModelChange(index, field, value)` for edits - auto-extracts model code from model name (regex: `/^([A-Za-z]+-\d+)/`)
- Calculate `totalAmount = price * totalQuantity` on field change
- Support double-click to open product search modal and populate from database

**Example Model Interface**:
```typescript
interface ModelInfo {
  id: number
  modelCode: string      // Auto-extracted from modelName (e.g., "N-2458")
  modelName: string      // Full product name
  description: string
  color: string
  currency: string       // TRY, USD, EUR
  currencyPrice: number  // Exchange rate adjusted price
  price: number          // Turkish Lira equivalent
  packageLot: number     // Package/lot size
  totalQuantity: number  // Final quantity to produce
  totalAmount: number    // price × totalQuantity (calculated)
}
```

### 2. İş Emri Oluştur (Create Work Orders) - Submission Phase
When form is submitted, create **one work order per model** with batch error handling.

**API Endpoint**: `POST /api/fason/work-orders`
- **Body**: Each model creates a separate work order:
```typescript
{
  orderNo: `${formData.orderNo}-${model.modelCode}`, // e.g., "2024-001-N-2458"
  productCode: model.modelCode,
  productName: model.modelName,
  quantity: model.totalQuantity,
  customerName: formData.customer,
  deliveryDate: formData.plannedDate,
  notes: model.description,
  assignedToMobile: boolean  // Flag for mobile app assignment
}
```
- **Response**: Return created `WorkOrder` object with `id`, `status: 'BEKLIYOR'` (AWAITING)
- **Error Handling**: Collect failures and show summary alert with success count + failure reasons

**Status Flow**:
```
BEKLIYOR (Awaiting) → ALINDI (Received) → ATÖLYEDE (At Workshop) → HAZIR (Ready) → TESLIM_EDILDI (Delivered)
```

### 3. Atölye Atama (Workshop Assignment) - Assignment Phase
Assign work orders to **workshops** (Fason partners) or mark as **mobile-assigned**.

**Frontend Pattern** (see [pages/fason/create-work-order.tsx](pages/fason/create-work-order.tsx#L706)):
```typescript
const handleCellClick = (order: WorkOrder) => {
  if (!order.assignedToMobile) {
    setSelectedOrderId(order.id);
    setIsWorkshopModalOpen(true); // Open workshop picker dialog
  }
};

const handleWorkshopSelect = (workshop: Workshop) => {
  handleWorkshopAssign(selectedOrderId); // Update work order
};

const handleWorkshopAssign = async (orderId: number) => {
  const response = await fetch(`/api/fason/work-orders/${orderId}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ assignedToMobile: true })
  });
};
```

**API Endpoint**: `PUT /api/fason/work-orders/[id]`
- **Body**: `{ assignedToMobile: boolean }` or `{ assignedUserId: number, status: string }`
- **Updates**: `updatedAt` timestamp, assignment fields, status

### 4. Mobil Takip (Mobile Tracking) - Production Phase
Mobile app tracks production progress using `assignedToMobile` flag.

**Mobile Endpoints**:
- `GET /api/fason/work-orders/mobile` - **Public** endpoint, no auth required, returns only `assignedToMobile: true` orders
- `POST /api/fason/tracking` - **Authenticated**, logs production updates (quantities, status changes, timestamps)
- `PUT /api/fason/work-orders/[id]` - Update status/quantities from mobile app

**Mobile Tracking Data**:
```typescript
// FasonTracking model fields
{
  workOrderId: number
  workshopId?: number
  quantity: number           // Produced/completed quantity
  defectiveQuantity: number
  notes: string
  trackedAt: DateTime       // Timestamp of production event
  trackedByUserId?: number  // Mobile app user ID
}
```

### Workshop Dialog Pattern
Used in modals for searchable selection with live filtering:
```typescript
const handleWorkshopSearch = (e: ChangeEvent<HTMLInputElement>) => {
  const searchTerm = e.target.value.toLowerCase();
  const filtered = workshops.filter(w =>
    w.name.toLowerCase().includes(searchTerm) ||
    w.contactPerson.toLowerCase().includes(searchTerm)
  );
  setFilteredWorkshops(filtered);
};

// Dialog structure: Search input → Table with rows → Click to select
<Dialog open={isWorkshopModalOpen}>
  <Input placeholder="Atölye ara..." onChange={handleWorkshopSearch} />
  <Table>
    {filteredWorkshops.map(w => (
      <TableRow onClick={() => handleWorkshopSelect(w)}>
        {/* ad, uzmanlık, yetkili, telefon */}
      </TableRow>
    ))}
  </Table>
</Dialog>
```

## Prisma Database Schema Reference

**Core Relations**:
- **WorkOrder** ↔ **FasonTracking** (1:Many) - Each work order tracked across production phases
- **WorkOrder** ↔ **User** (Many:1) - Mobile-assigned tracking users
- **FasonTracking** ↔ **FasonWorkshop** (Many:1) - Workshop assignments (nullable for mobile)
- **FabricEntry** ↔ **FabricExit** (1:Many) - Fabric consumption tracking
- **User** → Multiple roles via `role` enum + `stockAccess`, `fasonAccess` flags

**Key Models**:
```typescript
// WorkOrder - Main business entity for subcontracting jobs
model WorkOrder {
  id: number
  orderNo: string          // Unique across system (e.g., "2024-001-N-2458")
  productCode: string      // Extracted model code (e.g., "N-2458")
  productName: string      // Full product name
  quantity: number         // Total items to produce
  status: OrderStatus      // BEKLIYOR | ALINDI | ATÖLYEDE | HAZIR | TESLIM_EDILDI
  assignedToMobile: boolean // Flag for mobile app tracking
  assignedUserId: number?  // Linked user if assigned to specific tracker
}

// FasonTracking - Production progress updates
model FasonTracking {
  workOrderId: number      // Links to WorkOrder
  workshopId: number?      // Optional workshop (null if mobile)
  processType: ProcessType // KESIM | DIKIM | BASKI_NAKIS | UTU
  status: ProcessStatus    // Current step status
  startDate, endDate: DateTime
  notes: string           // Production notes
  latitude, longitude: number? // GPS coordinates for mobile tracking
}

// FasonWorkshop - Subcontracting partner
model FasonWorkshop {
  name: string            // Unique workshop name
  specialization: WorkshopType // DIKIM | BASKI_NAKIS | UTU
  contactPerson: string
  phone: string
  balance: Float          // Account balance tracking
  totalEarnings, totalPayments: Float
}

// User - Role-based access control
model User {
  email: string           // Unique login identifier
  role: Role              // ADMIN | OPERATOR | STOCK_MANAGER | FASON_TRACKER
  stockAccess: boolean    // Can access fabric stock module
  fasonAccess: boolean    // Can access fason subcontracting module
}
```

**Enum Reference** (Important for filtering/validation):
```typescript
enum OrderStatus {
  BEKLIYOR        // Awaiting processing
  ALINDI          // Received/accepted
  ATÖLYEDE        // At workshop
  HAZIR           // Ready for delivery
  TESLIM_EDILDI   // Delivered
  SORUN_VAR       // Problem/issue
}

enum ProcessType {
  KESIM      // Cutting
  DIKIM      // Sewing
  BASKI_NAKIS // Printing/embroidery
  UTU        // Ironing/pressing
}
```

**Common Queries**:
```typescript
// Get mobile-assigned orders (for mobile app endpoint)
const mobileOrders = await prisma.workOrder.findMany({
  where: { assignedToMobile: true },
  include: { fasonTrackings: true }
});

// Get workshop-assigned orders
const workshopOrders = await prisma.workOrder.findMany({
  where: { assignedToMobile: false },
  include: { assignedUser: true, fasonTrackings: { include: { workshop: true } } }
});

// Get current tracking status
const tracking = await prisma.fasonTracking.findFirst({
  where: { workOrderId: orderId },
  orderBy: { createdAt: 'desc' }
});

// Update work order status (atomic)
await prisma.workOrder.update({
  where: { id: orderId },
  data: { 
    status: 'ATÖLYEDE',
    updatedAt: new Date()
  }
});
```

**Migration Pattern**:
```bash
# Create schema changes
npx prisma migrate dev --name describe_change

# Sync local schema (dev only)
npx prisma db push

# Generate types after schema updates
npx prisma generate

# Seed database
npx ts-node prisma/seed.ts
```

## Troubleshooting & Common Issues

### Token/Authentication Errors

**Problem**: `401 Unauthorized` or "Token bulunamadı" errors

**Debugging Steps**:
```typescript
// 1. Check if token exists in localStorage
const token = localStorage.getItem('token');
console.log('Token exists:', !!token);
console.log('Token value:', token); // Log first 20 chars only for security

// 2. Verify token format in API call
const headers = {
  'Authorization': `Bearer ${token}`, // Must include "Bearer " prefix
  'Content-Type': 'application/json'
};

// 3. Test token validity with dedicated endpoint
const testRes = await fetch('/api/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
console.log('Token valid:', testRes.ok);
```

**Common Causes**:
- Missing `Bearer ` prefix in Authorization header (should be `"Bearer eyJhbGc..."` not `"eyJhbGc..."`)
- Token expired (check expiry with `jwt.decode()` in browser console)
- Wrong `JWT_SECRET` in `.env` (must match server)
- Token stored as JSON string instead of plain string (check `typeof`)

### API Validation Errors

**Problem**: `400 Bad Request` with validation error messages

**Example Fix**:
```typescript
// Frontend: Validate BEFORE sending to API
const errors: string[] = [];

// Check required fields
if (!formData.orderNo?.trim()) {
  errors.push("İş emri no zorunludur!");
}

// Check array length
if (modelInfos.length === 0) {
  errors.push("En az bir model bilgisi eklenmelidir!");
}

// Check numeric constraints
modelInfos.forEach((model, i) => {
  if (model.totalQuantity <= 0) {
    errors.push(`Model ${i + 1}: Miktar 0'dan büyük olmalıdır`);
  }
});

if (errors.length > 0) {
  alert("Doğrulama Hatası:\n\n" + errors.join("\n"));
  return; // Stop submission
}

// Then send only valid data
```

**API Response Handling**:
```typescript
if (!response.ok) {
  const errorData = await response.json();
  // API returns: { error: "message" }
  throw new Error(errorData.error || 'Unknown error');
}
```

### Prisma Relation & Query Issues

**Problem**: "Relation error" or undefined relation data

**Example**: Getting WorkOrder with related FasonTrackings
```typescript
// ❌ WRONG - Missing include
const order = await prisma.workOrder.findUnique({ 
  where: { id: orderId } 
});
console.log(order.fasonTrackings); // undefined!

// ✅ CORRECT - Include relations
const order = await prisma.workOrder.findUnique({
  where: { id: orderId },
  include: { 
    fasonTrackings: true,
    assignedUser: true // Also get user data
  }
});
console.log(order.fasonTrackings); // Array of tracking records
```

**Enum Case Sensitivity**:
```typescript
// ❌ WRONG - Wrong case
await prisma.workOrder.update({
  where: { id: orderId },
  data: { status: 'Bekliyor' } // Prisma will reject
});

// ✅ CORRECT - Exact enum value
await prisma.workOrder.update({
  where: { id: orderId },
  data: { status: 'BEKLIYOR' } // Must match schema exactly
});
```

### Form State Management Issues

**Problem**: Changing array items doesn't trigger re-render

**❌ Problematic Pattern**:
```typescript
// This modifies state directly - React won't detect change
const updateModel = (index, field, value) => {
  modelInfos[index][field] = value; // Direct mutation!
  setModelInfos(modelInfos); // Same array reference = no re-render
};
```

**✅ Correct Pattern**:
```typescript
const updateModel = (index, field, value) => {
  // Create NEW array to trigger React detection
  const updatedModels = [...modelInfos];
  updatedModels[index] = {
    ...updatedModels[index], // Shallow copy object
    [field]: value
  };
  setModelInfos(updatedModels); // NEW array reference
};
```

### Mobile Assignment & Tracking Sync

**Problem**: `assignedToMobile` flag not syncing between frontend and mobile app

**Debugging Workflow**:
```typescript
// 1. Check database directly
// SELECT id, orderNo, assignedToMobile FROM "WorkOrder" WHERE id = 123;

// 2. Verify API returns correct value
const order = await fetch(`/api/fason/work-orders/${orderId}`)
  .then(r => r.json());
console.log('assignedToMobile:', order.assignedToMobile);

// 3. Verify UPDATE worked
const updateRes = await fetch(`/api/fason/work-orders/${orderId}`, {
  method: 'PUT',
  body: JSON.stringify({ assignedToMobile: true })
});
const updated = await updateRes.json();
console.log('After update:', updated.assignedToMobile); // Should be true
```

**Mobile Endpoint Check**:
```bash
# This endpoint is PUBLIC - no auth needed
curl http://localhost:3000/api/fason/work-orders/mobile

# Should return ONLY orders with assignedToMobile: true
```

### Data Loss After Form Submission

**Problem**: Form data resets but API call failed silently

**Solution - Track Error State**:
```typescript
const [error, setError] = useState<string | null>(null);

const handleSubmit = async () => {
  try {
    setError(null); // Clear previous errors
    const response = await fetch('/api/endpoint', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const err = await response.json();
      setError(err.error || 'Failed to submit');
      return; // DON'T reset form
    }
    
    // Only reset after confirmed success
    setFormData(initialState);
    
  } catch (err) {
    setError((err as Error).message);
  }
};

// In JSX
{error && <div className="text-red-600">{error}</div>}
```

## Tauri Desktop Integration

The app runs as a Tauri desktop application (Windows/Mac/Linux). Key integration points:

### Build & Runtime
- **Dev Mode**: `npm run dev` launches Next.js server + Tauri dev window automatically
- **Build & Package**: `npm run build` compiles Next.js then bundles with Tauri for desktop distribution
- **Tauri Config**: [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) controls window behavior, permissions, and bundle settings
- **Cargo Integration**: [src-tauri/Cargo.toml](src-tauri/Cargo.toml) manages Rust dependencies for desktop features

### Desktop-Specific Considerations

**Window Handling** (from `tauri.conf.json`):
```json
{
  "window": {
    "title": "Fabric Stock",
    "width": 1200,
    "height": 800,
    "resizable": true,
    "fullscreen": false
  }
}
```

**Environment Detection**:
```typescript
// Detect if running in Tauri/desktop context
const isTauri = typeof window !== 'undefined' && window.__TAURI__;

if (isTauri) {
  // Desktop-specific code (file system, native dialogs, etc.)
  // This code is safe from Next.js SSR issues
}
```

**API Server Port**:
- Dev mode: Next.js runs on `http://localhost:3000` (fronted by Tauri window)
- Production (desktop build): Next.js bundled with Tauri, accessible via window

### File System Operations

**Tauri provides file system access** (requires permissions in `tauri.conf.json`):
```typescript
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

// Open file dialog
const filePath = await open({
  filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
});

// Read file content
const content = await readTextFile(filePath);

// Write to file (export feature)
await writeTextFile('report.xlsx', binaryData);
```

### Serialport Integration

Device communication for serial ports (fabric scale, barcode scanners):
```typescript
import { SerialPort } from 'serialport';

// List available serial ports
const ports = await SerialPort.list();

// Open connection
const port = new SerialPort({
  path: '/dev/ttyUSB0', // Linux/Mac: /dev/ttyUSB*; Windows: COM*
  baudRate: 9600
});

port.on('data', (data) => {
  console.log('Scale weight:', data.toString());
  // Process weight data from fabric scale
});
```

**Scale Integration** (see [pages/api/scale.ts](pages/api/scale.ts)):
- Reads weight from connected serial device
- Used in fabric entry module for automatic weight capture
- Endpoint: `GET /api/scale/weight` returns current device reading

### Print Dialog (Desktop-Only)

Print work orders, labels, reports using native print dialog:
```typescript
if (typeof window !== 'undefined' && window.__TAURI__) {
  // Desktop print
  window.print(); // Opens native print dialog
} else {
  // Web fallback
  const printWindow = window.open('/report', '_blank');
  printWindow?.print();
}
```

### Permissions in tauri.conf.json

Ensure proper permissions for desktop features:
```json
{
  "tauri": {
    "allowlist": {
      "fs": {
        "all": false,
        "readFile": true,
        "writeFile": true,
        "readDir": true,
        "createDir": true
      },
      "dialog": {
        "all": false,
        "open": true,
        "save": true
      },
      "http": {
        "all": false,
        "request": true
      }
    }
  }
}
```

## File Organization

- **Pages**: User-facing screens (Turkish naming: `fason.tsx`, `fabric-entry.tsx`, etc.)
- **API Routes**: RESTful endpoints under `pages/api/`; structure mirrors business domains (fason, stock, auth)
- **Components**: Reusable React components; `ui/` subfolder for base UI library
- **Lib**: Utility functions (`prisma.ts` singleton, `auth.ts` token verification, `api.ts` axios instance)
- **Prisma**: Database schema ([prisma/schema.prisma](prisma/schema.prisma)) and migrations
- **Tauri**: Desktop runtime configuration ([src-tauri/tauri.conf.json](src-tauri/tauri.conf.json)) and Rust code ([src-tauri/src/](src-tauri/src/))

## Important Notes

- **Token Expiry**: JWT set to expire in 1 day (`{ expiresIn: "1d" }`)
- **CORS & Headers**: Express/Next.js handle CORS; always include `'Content-Type': 'application/json'` and auth header in fetch
- **No Frontend TypeScript Errors**: `typescript.ignoreBuildErrors: true` in `next.config.js` (review before production!)
- **Environment Variables**: `.env` should contain `DATABASE_URL` and `JWT_SECRET`
- **Prisma Migrations**: Always use Prisma migrate for schema changes; test with seed data
- **Enum Consistency**: Use exact enum values (BEKLIYOR not Bekliyor) - case-sensitive in database
