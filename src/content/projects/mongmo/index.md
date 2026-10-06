---
title: "Mongmo"
section: featured
order: 2
category: "Mobile"
types: ["mobile", "fullstack"]
year: "2026"
tech: ["Expo", "React Native", "TypeScript", "Supabase", "PostgreSQL", "TanStack Query", "Zustand"]
role: "Design & development"
context: "Devine (Howest) — Creative Development, React challenge"
description: "An app for Mongmo, a Vietnamese café brand running pop-ups across Belgium: discover pop-ups, check in on site, complete challenges, earn rewards and order ahead — with prices, check-ins and points decided by the server, not the phone."
scope:
  - Geofenced pop-up discovery
  - QR + GPS check-in
  - Eleven challenge types, points, badges and rewards
  - Order ahead with a live status board for owners
  - Server-authoritative Supabase / PostgreSQL backend
  - Native features with web fallbacks
media:
  screenshot: "./cover.png"
tags: ["Mobile", "Product", "Supabase"]
---

## The project
Mongmo is a Vietnamese café brand that runs short pop-ups across Belgium: brunches, DJ nights, food trucks and market stalls. The app helps people discover those pop-ups and rewards them for showing up.

Guests check in by scanning a QR code at the venue, then complete challenges such as taking a photo, rating a dish, voting on a menu item or filling a dance meter by moving with their phone. They earn points, badges and rewards, and can order ahead for pickup.

Owners can create pop-ups, configure challenges, display check-in QR codes and manage incoming orders through a status board.

## Why an app instead of a website?
Pop-ups are temporary and constantly move location, which makes them easy to miss. A traditional website only helps when someone remembers to check it. Mongmo needed to reach people when a pop-up was actually relevant to them.

Several of its core features also depend directly on the phone:

- **Location-based discovery:** geofencing can alert users when they enter the 500 m region around an active pop-up.
- **Presence-based check-in:** a QR scan is combined with the phone's GPS position to verify that the user is actually near the venue.
- **Physical challenges:** the dance meter uses motion-sensor data, while photo challenges use the camera and photo library.
- **Notifications:** users can be notified about nearby pop-ups, order updates, rewards and badges.
- **Native interactions:** haptic feedback, system date controls, maps and calendar integration make these features feel like part of the device rather than additions to a website.

The same codebase also builds for the web through React Native Web. Native-only features have fallbacks: adding an event to the calendar downloads an `.ics` file, for example, while haptic feedback is simply disabled.

## Stack
Expo / React Native · TypeScript · Supabase / PostgreSQL · TanStack Query · Zustand

Expo provides the native capabilities needed for location, camera, sensors, notifications and calendar access while keeping most of the project in one TypeScript codebase.

Supabase handles authentication, PostgreSQL, file storage and realtime updates. TanStack Query manages server state and caching, while Zustand is reserved for local state such as the cart, filters and settings.

## Engineering decisions

### 1. The client sends intent. The server decides the result.
One of the main architectural decisions was to make the database authoritative.

When someone places an order, the app sends item IDs and quantities, but never the price:

```ts
const { data: order, error } = await supabase.rpc('create_order', {
  p_event_id: location.type === 'event' ? location.eventId : null,
  p_items: items.map((item) => ({
    menu_item_id: item.menuItemId,
    quantity: item.quantity,
  })),
  p_pickup_at: pickupAt,
  p_user_reward_id: userRewardId,
});

if (error) throw toApiError(error);
```

The database looks up the current price itself, verifies that each item belongs to the correct menu and stores a snapshot of the name and price with the order. This means changing a menu later cannot rewrite an old receipt.

Check-in follows the same principle. The app submits the scanned QR token and the device's coordinates. The server then verifies three things:

1. the QR token belongs to that event;
2. the pop-up is currently running;
3. the device is within 500 m of the venue.

The app performs some of these checks earlier to give faster feedback, but those checks are only for UX. The server determines whether the action actually succeeds.

This means the rules still apply if someone bypasses the interface and calls the API directly.

**Trade-off:** keeping business logic in SQL is less convenient to unit test than keeping everything in TypeScript, but it prevents security-sensitive rules from depending on a trusted client.

### 2. Security beyond row-level security
Supabase's row-level security controls which rows users can access, but Mongmo had a case where that was not enough.

The QR token is stored on the same event row as public information such as its title, location and date. Giving users normal read access to that row would also expose the QR token, making the check-in system pointless.

Instead, read access is explicitly granted only to safe columns. Owners retrieve the token separately through a function that verifies ownership.

A security review exposed another issue involving PostgreSQL `SECURITY DEFINER` functions.

These functions execute with the privileges of their owner. An internal function used to award badges was still executable by authenticated users, which meant someone could call it directly and award themselves a badge and its points.

The internal functions now explicitly revoke execution access:

```sql
revoke execute
on function public.award_badge(uuid, text)
from public, anon, authenticated;

revoke execute
on function public.evaluate_badges(uuid)
from public, anon, authenticated;
```

The lesson was simple: privileged internal functions should be deny-by-default.

### 3. A challenge system that can grow
Mongmo has eleven challenge types with different requirements: photos, votes, ratings, timed challenges, motion challenges and others.

Creating a separate system for every type would quickly become difficult to maintain, so they share one challenge model with a JSON configuration.

TypeScript maps each challenge type to the configuration it expects:

```ts
export type ChallengeConfigByType = {
  capture: {
    photoCount: number;
    prompt: string;
  };

  community: {
    options: string[];
  };

  motion: {
    seconds: number;
  };

  // ...
};

export type ChallengeRules = {
  [Type in ChallengeType]: {
    type: Type;
    config: ChallengeConfigByType[Type];
  };
}[ChallengeType];
```

Once the challenge type is checked, TypeScript automatically knows which configuration fields are valid.

The database validates the configuration again before storing it, applying defaults and limiting values to acceptable ranges.

Completion also checks actual evidence rather than trusting the client. A photo challenge, for example, counts the uploaded files that exist in storage instead of accepting a message from the app saying that the photos were uploaded.

This keeps the system flexible without giving up type safety or server-side validation.

### 4. Points are a ledger, not a balance
Instead of storing one mutable `points` number on each profile, every change becomes an entry in an append-only ledger.

A challenge or badge adds points. Redeeming a reward creates a negative entry.

The user's balance is the sum of those entries.

This gives every point a traceable source, prevents two simultaneous actions from overwriting the same balance and allows corrections to be represented as new entries rather than rewriting history.

The same data can also be used for leaderboards by summing entries over a specific time range.

**Trade-off:** the balance has to be calculated when it is read, but that cost is negligible at Mongmo's current scale.

## Building around the phone

### Geofenced pop-up discovery
Mongmo registers a region around relevant pop-ups using `expo-location` and `expo-task-manager`.

When the operating system reports that the device has entered one of those regions, the background task checks whether the event is currently active and whether the user has already been alerted recently.

```ts
const regions = events.map((event) => ({
  identifier: `event:${event.id}`,
  latitude: event.coordinates.latitude,
  longitude: event.coordinates.longitude,
  radius: 500,
  notifyOnEnter: true,
  notifyOnExit: false,
}));

await Location.startGeofencingAsync(
  GEOFENCE_TASK_NAME,
  regions
);
```

This means notifications are tied to both place and time. Entering the location of yesterday's pop-up should not generate an alert today.

Location is also used during check-in and in the owner's event editor, where addresses are converted to coordinates automatically.

### Native features without tying the UI to one platform
Platform-specific behaviour is kept behind shared interfaces.

Calendar integration is one example. On iOS and Android, Mongmo can open the system's event interface. On the web, the same `addToCalendar()` call generates an `.ics` file instead.

Metro automatically selects the `.web.ts` implementation for web builds, so the screen itself does not need to know which platform it is running on.

The same principle is used elsewhere: SF Symbols fall back to Lucide icons outside iOS, and haptic feedback becomes a no-op on the web.

This keeps platform differences at the service/component boundary instead of spreading `Platform.OS` checks throughout the application.

### Debugging the dance meter that never moved
One of the hardest bugs in the project came from the dance challenge.

The original implementation counted dancing using the motion event's reported interval:

```ts
total += interval || SAMPLE_MS;
```

The interval was expected to be in milliseconds.

On a real iPhone, however, the meter barely moved. After tracing the value into the library's Swift implementation, I found this:

```swift
"interval": Double(
  self.motionManager.deviceMotionUpdateInterval
)
```

iOS was providing the value in seconds. An interval of `0.1` represented 100 ms, while the application was effectively treating it as 0.1 ms.

Around 30 seconds of dancing could therefore be counted as only a few milliseconds.

Instead of converting a library-specific value and continuing to depend on it, I changed the algorithm to measure elapsed time between readings itself:

```ts
export function addDanceReading(
  progress: DanceProgress,
  force: number,
  at: number
): DanceProgress {
  const step =
    progress.lastReadingAt === null
      ? 0
      : Math.min(
          Math.max(at - progress.lastReadingAt, 0),
          MAX_STEP_MS
        );

  const lastMoveAt =
    force >= DANCE_MOVE_THRESHOLD
      ? at
      : progress.lastMoveAt;

  const dancing =
    lastMoveAt !== null &&
    at - lastMoveAt <= MOVE_HOLD_MS;

  return {
    activeMs: progress.activeMs + (dancing ? step : 0),
    lastReadingAt: at,
    lastMoveAt,
  };
}
```

Each time step is capped so a pause between sensor readings cannot suddenly count as dancing. A detected movement also remains active briefly to account for natural gaps between movements.

The calculation is now a pure function, which means it can be checked with simulated sensor readings without needing a physical phone.

The investigation also uncovered a separate web issue with the motion library. Motion handling was split into native and web implementations, with the web version listening directly to the browser's `devicemotion` event.

There is still a limitation: motion data originates on the user's device. The server can verify that the submitted duration is plausible, but it cannot independently prove that someone actually danced.

That level of trust is acceptable for game points. It would not be appropriate for anything involving money.

## What I'd improve next
- **Automated testing and CI.** Add API and end-to-end tests for the most important flows and run them on every pull request.
- **Real payments.** Replace the prototype payment step with a provider such as Mollie, with payment confirmation handled server-side through webhooks.
- **Generated database types.** Generate TypeScript types directly from the Supabase schema instead of maintaining them manually.
- **Remote push notifications.** Allow important order and event updates to reach users independently of local notification logic.
- **Owner tools.** Build a complete menu editor for creating and managing products.
- **Rate limiting.** Protect sensitive operations such as check-in and challenge completion from repeated automated requests.

## Takeaway
Building Mongmo as an app made the core concept possible: location-based discovery, presence-based check-ins and challenges that use the camera and motion sensors.

The most important architectural decision was making the database authoritative. Prices, check-ins, points, badges and challenge completion are validated server-side rather than depending on what the client reports.

The dance-meter bug also changed how I approach dependencies. Documentation is useful, but when the behaviour does not match it, reading the library's source can reveal assumptions that would otherwise be difficult to find.
