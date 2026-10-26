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
description: "A cross-platform application for discovering Mongmo's pop-up events, completing location-based challenges, earning rewards and ordering ahead. Built with React Native and a Supabase backend."
scope:
  - Cross-platform mobile and web application
  - Geofenced event discovery and QR/GPS check-in
  - Eleven configurable challenge types
  - Ordering, rewards and live order management
  - Server-side validation and PostgreSQL security
  - Native device features with web fallbacks
media:
  screenshot: "./media/cover.jpg"
  gallery:
    - "./media/cover.jpg"
    - "./media/ordering.jpg"
    - "./media/explore.jpg"
tags: ["Mobile", "React Native", "Supabase"]
customPage: true
tagline: "A cross-platform app for Mongmo's pop-ups: find events, complete challenges, earn rewards and order ahead."
tv: "/media/tv/mongmo.mp4"
---

## The project

Mongmo is a Vietnamese café brand that organises temporary pop-ups across Belgium, including brunches, DJ nights and market events.

I designed and developed a cross-platform application that helps customers discover upcoming pop-ups, check in at venues, participate in challenges and earn rewards. Customers can also order ahead for pickup.

The application includes an owner interface for creating events, managing challenges and tracking incoming orders.

## Why a mobile application?

Mongmo's events are temporary and frequently change location. The application needed to help customers discover nearby events and interact with them while physically attending.

Several features depend on native device capabilities:

- **Geofencing:** Notifies customers when they enter a 500 m region around an active event.
- **QR and GPS check-in:** Combines a scanned QR code with location verification.
- **Interactive challenges:** Uses the camera and motion sensors for activities such as photo submissions and dancing.
- **Notifications:** Provides updates about events, orders and rewards.

The application also supports web through React Native Web, with alternative implementations for features that require native APIs.

## Stack

React Native · Expo · TypeScript · Supabase · PostgreSQL · TanStack Query · Zustand

Expo provides access to native functionality while maintaining a shared TypeScript codebase across platforms.

Supabase handles authentication, PostgreSQL, storage and realtime updates. TanStack Query manages server state and caching, while Zustand handles local state such as the shopping cart, filters and settings.

## Server-authoritative architecture

One of the main architectural decisions was keeping business rules on the server rather than trusting data submitted by the application.

For example, when a customer places an order, the client sends product IDs and quantities, but not prices.

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

PostgreSQL retrieves the current prices, validates the items and stores a snapshot of the order. This prevents client-side price manipulation and preserves historical receipts when menu prices change.

The same approach applies to check-ins. The client submits the QR token and device coordinates, while the server verifies the event, its operating hours and the customer's distance from the venue.

Client-side checks provide immediate feedback, but the server makes the final decision.

## Database security

Supabase uses PostgreSQL row-level security to control data access. However, some operations required additional restrictions.

For example, an event's QR token is stored alongside public event information. Granting unrestricted read access would expose the token and compromise the check-in process.

I restricted access to sensitive columns and implemented a separate function that allows verified event owners to retrieve their QR codes.

During a security review, I also identified an issue with PostgreSQL `SECURITY DEFINER` functions.

An internal function responsible for awarding badges could be called directly by authenticated users, potentially allowing them to award themselves badges and points.

I corrected this by explicitly revoking execution permissions from public roles:

```sql
revoke execute
on function public.award_badge(uuid, text)
from public, anon, authenticated;
```

Privileged functions are now accessible only through the intended server-side operations.

## Configurable challenge system

Mongmo supports eleven challenge types, including photo submissions, ratings, voting, timed activities and motion-based challenges.

Rather than implementing a separate data structure for every challenge, I created a shared model with type-specific configuration.

TypeScript uses a discriminated union to associate each challenge type with its required fields:

```ts
export type ChallengeRules = {
  [Type in ChallengeType]: {
    type: Type;
    config: ChallengeConfigByType[Type];
  };
}[ChallengeType];
```

This provides type checking during development while allowing new challenge types to be added without restructuring the entire system.

The database also validates configurations and challenge completion. For example, photo challenges verify uploaded files in storage instead of relying on the client's completion status.

## Points and rewards

Instead of storing a single points balance on each user's profile, Mongmo uses an append-only transaction ledger.

Completing challenges and earning badges creates positive entries, while redeeming rewards creates negative entries.

The balance is calculated from the sum of these transactions.

This provides a history of how points were earned or spent, avoids overwriting balances during simultaneous operations and supports calculating leaderboards over different periods.

The trade-off is that balances require aggregation when retrieved, which is acceptable at the application's current scale.

## Native features and cross-platform development

The application uses Expo's native APIs for location, camera access, notifications, motion sensors and calendar integration.

Platform-specific functionality is separated into dedicated implementations.

For example, adding an event to the calendar opens the native calendar interface on iOS and Android. On the web, the same function generates an `.ics` file.

Metro selects the appropriate platform implementation automatically, allowing the rest of the application to use the same interface without repeated platform checks.

Geofencing also uses background location tasks to detect when customers enter the region around an active pop-up. Notifications are checked against event dates and previous alerts to avoid notifying users about expired events.

## Debugging the motion sensor

One of the most challenging issues occurred while implementing the dance challenge, which measures how long a customer is actively moving.

The original implementation calculated dancing time using the motion sensor's reported interval:

```ts
total += interval || SAMPLE_MS;
```

During testing on a physical iPhone, the progress meter barely increased.

After tracing the value into the library's native Swift implementation, I discovered that iOS reported the interval in seconds, while the application expected milliseconds.

An interval of `0.1` represented 100 milliseconds but was effectively being counted as 0.1 milliseconds.

Rather than depending on the library's interval value, I changed the implementation to calculate elapsed time between sensor readings.

The revised algorithm also caps the time between readings to prevent interruptions from incorrectly increasing progress.

I extracted the calculation into a pure function, making it possible to test the behaviour with simulated sensor data without requiring a physical device.

The investigation also revealed a separate compatibility issue with the web implementation. I addressed this by separating native and browser motion handling, using the browser's `devicemotion` event for web.

## Takeaway

Mongmo gave me experience developing a cross-platform application that combines native device functionality with a relational backend.

The main technical challenges involved designing reusable systems for different challenge types, securing operations involving points and rewards, and ensuring that business rules were enforced independently of the client.

Debugging the motion sensor also reinforced the importance of testing on physical devices and inspecting third-party implementations when their behaviour differs from the documentation.
