# ⚠️ Supabase Configuration Required

## Problem
The tutor dashboard shows data on your PC but not on other devices because:
- Data is currently stored in browser `localStorage` (device-specific)
- Supabase is not properly configured with real credentials
- The `.env.local` file has placeholder values

## Solution: Configure Supabase

### Step 1: Get Your Supabase Credentials

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create a free account
3. Create a new project (or use existing one)
4. Go to **Project Settings** → **API**
5. Copy these values:
   - **Project URL** (e.g., `https://xyzabc123.supabase.co`)
   - **Anon/Public Key** (starts with `eyJ...`)

### Step 2: Update `.env.local`

Replace the placeholder values in your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Keep the rest as is
CALCOM_API_KEY=your_calcom_api_key
NEXT_PUBLIC_CALCOM_USERNAME=your_calcom_username
NEXT_PUBLIC_SENDBIRD_APP_ID=C6BB4526-3FA5-416D-B30D-423D4EC09E92
SENDBIRD_API_TOKEN=2df4528d241fb5b844845d71942302edf33e8e4f
```

### Step 3: Set Up Database Tables

1. Go to your Supabase project
2. Click **SQL Editor** in the sidebar
3. Create a new query
4. Copy and paste the contents of `supabase-setup.sql`
5. Click **Run** to create all tables

### Step 4: Restart Your Dev Server

```bash
npm run dev
```

## What Will Work After Setup

✅ **Tutor bookings** will sync across all devices
✅ **Tutor availability** will be saved to the cloud
✅ **User bookings** will persist across browsers
✅ **Real-time data** available on any device

## Current Fallback Behavior

Until Supabase is configured:
- Data saves to `localStorage` only (device-specific)
- Console shows: "Failed to load from Supabase, using localStorage"
- Each device has its own isolated data

## Verify It's Working

After configuring Supabase, check the browser console:
- ✅ Should see: "Loaded X bookings from Supabase"
- ✅ Should see: "Availability saved to Supabase"
- ❌ Should NOT see: "placeholder-anon-key" errors

## Testing Across Devices

1. Configure Supabase on your main PC
2. Create a booking or update availability
3. Open the same URL on another device (use same login)
4. Data should appear immediately!

## Need Help?

- 📖 [Supabase Documentation](https://supabase.com/docs)
- 📧 Contact: munichscholarmentors@gmail.com
