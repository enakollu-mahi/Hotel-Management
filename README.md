# Hotel Mahidar (Hotel Mahi)

Hotel booking and management web app — Node.js backend, single-page frontend, MySQL (optional fallback mode without DB).

## Project structure

```
hotel-mahidar/
├── index.html          # Frontend 
├── server.js           # API + serves the website
├── package.json
├── mysql-config.js     # Your local DB config (create from example)
├── mysql-config.example.js
├── assets/             # Images, static files
└── README.md
```

## Quick start

1. **Install Node.js** (v18+ recommended).

2. **Install packages**
   ```bash
   npm install
   ```

3. **MySQL (optional but recommended)**
   - Install MySQL and start the service.
   - Copy config: `copy mysql-config.example.js mysql-config.js` (Windows) or `cp mysql-config.example.js mysql-config.js` (Mac/Linux).
   - Edit `mysql-config.js` with your MySQL password.

4. **Run the server**
   ```bash
   npm start
   ```

5. **Open in browser**  
   [http://localhost:3000](http://localhost:3000)  
   Do not open `index.html` directly as a file — always use the server URL.

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm start`    | Start production server  |
| `npm run dev`  | Start with auto-reload   |

## API

Base URL: `http://localhost:3000/api`

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/rooms`, `GET /api/services`, `GET /api/staff`
- `POST /api/bookings`, `POST /api/payments` (auth required)

## GitHub

```bash
git init
git add .
git commit -m "Initial commit: Hotel Mahidar management system"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub account and repository name.

**Note:** `mysql-config.js` is not uploaded (see `.gitignore`). Each developer copies `mysql-config.example.js` locally.

## License

MIT
