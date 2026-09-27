# Firebase setup - Com Nha In

The web app is configured for Firebase project `com-nha-in`. Firebase web config is public client configuration; Firestore Security Rules and Firebase Authentication protect the data.

## One-time Firebase Console setup

1. In Firebase Console, open project `com-nha-in` and create a **Cloud Firestore** database.
2. In **Authentication > Sign-in method**, enable **Email/Password**.
3. In **Authentication > Users**, create the restaurant administrator account and copy its UID.
4. In Firestore, create collection `admins`, then a document whose document ID is that UID. Add `{ "role": "admin" }`.
5. Publish the contents of [`firestore.rules`](firestore.rules) from **Firestore Database > Rules**.
6. Serve this site over HTTP. For local development use `http://localhost`; add the production hostname under **Authentication > Settings > Authorized domains** before deploying.

Do not create an `admins` document for a customer account. The admin page stays locked unless the signed-in UID has that document.

## Collections

- `products`: public menu items. Set `active: true` for items customers can order. Fields: `name`, `price`, `category`, `description`, `emoji`, `active`; `image` is optional.
- `orders`: created by checkout. Customers can create a validated pending order but cannot read or edit orders. Admins can view and manage them.
- `employees`: admin-only staff records.
- `inventory`: admin-only stock records.
- `admins`: one document per authorized Firebase Auth UID. Only that signed-in user can read their own membership document; client writes are denied.

When `products` is empty, the first authorized admin visit seeds it from the current local sample menu. Other empty collections start empty. Customized local records are migrated when their cloud collection is empty; seeded demo orders are not migrated.

## Running locally

Open the project through a local HTTP server, not `file://`, so Firebase Authentication can validate the origin. A hostname not listed in Firebase Authorized domains will be rejected by Auth.

Firebase Analytics is not initialized by the app; it is optional and not required for Firestore or Authentication.
