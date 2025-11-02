# Online Yard Sale — GitHub Pages + Firebase (No Python)

This is a **static** site you can host on **GitHub Pages**. It uses **Firebase** for:
- Auth (Email/Password)
- Firestore (listings, categories)
- Storage (images)

## What you get
- Login / Register (Email + password)
- Create / edit / delete **your own** listings
- Image upload for listings
- Categories + search
- **Admin** can delete or deactivate any listing, manage categories
- Fully client-side — just upload these files to GitHub Pages

---

## 1) Create Firebase project (one-time)
1. Go to https://console.firebase.google.com → **Add project**.
2. In **Build → Authentication → Sign-in method**, enable **Email/Password**.
3. In **Build → Firestore Database**, click **Create database** (in production mode or test).
4. In **Build → Storage**, click **Get started**.

## 2) Add a web app and get config
- In the Firebase project settings, **Add app → Web app**.
- Copy the config object (apiKey, authDomain, projectId, storageBucket, etc.).
- Open `firebase-config.js` and **paste your config** into `window.FIREBASE_CONFIG`.

## 3) Add an admin list (for moderation)
- In Firestore, create a document at: **`meta/admins`** with data:
  ```json
  { "emails": ["your-email@example.com"] }
  ```
- You can add more admin emails later by editing that array.

## 4) Set security rules (copy/paste these)
- Firestore rules: open the Rules tab and replace with the contents of `firestore.rules`.
- Storage rules: open Storage → Rules and replace with the contents of `storage.rules`.

## 5) Run it locally (optional)
Just open `index.html` in your browser. (Chrome may block local `import`– if so, use a simple local server or push to GitHub Pages.)

## 6) Publish to GitHub Pages
1. Create a new GitHub repo and **upload** these files (index.html, app.js, styles.css, firebase-config.js, assets/).
2. In the repo settings → **Pages**, choose **Deploy from a branch**, then select **main** and `/ (root)` as folder.
3. Wait for Pages to build; open the URL it shows (e.g., https://yourname.github.io/your-repo).

---

### Notes
- Categories are stored in Firestore collection `categories` (name, slug). The UI can create/delete them (admin only).
- Listings live in `listings` documents: { title, description, price, category, imageUrl, userId, userEmail, createdAt, isActive }.
- Image uploads go to Storage path `listings/{uid}/{timestamp}.jpg`.
- Search filters by title/description on the client side.
