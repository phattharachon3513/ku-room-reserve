# KU Room Reserve

## XAMPP / MySQL
1. Start Apache + MySQL in XAMPP.
2. Open phpMyAdmin and import `schema.sql`.
3. If your MySQL password is not blank, edit `api/config.php`:
   `'password' => 'YOUR_PASSWORD'`
4. Put this folder at `C:/xampp/htdocs/myku` and open `http://localhost/myku/`.

## Login
Register uses a `@ku.th` email and password. New teacher accounts are `pending` until an admin approves them. Passwords are stored with PHP `password_hash`; login uses a secure PHP session cookie. The imported `schema.sql` includes a demo admin: `admin@ku.th` / `ChangeMeNow!2026`; change or remove it before production.

## Vercel
Vercel can host the static UI (`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`). It cannot execute this PHP API or host MySQL. For production use one of these setups:
- Frontend: Vercel. API: PHP hosting/Railway/Render with MySQL. Set the API base URL in `app.js` (`api/index.php` -> `https://YOUR-API/api/index.php`).
- Or migrate `api/index.php` to Vercel Functions (Node.js) and use a cloud MySQL provider such as PlanetScale, Aiven, Railway, or TiDB Cloud.

Do not expose MySQL directly to the browser. Only the API should contain DB credentials.
