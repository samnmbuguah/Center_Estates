# Testing the mobile app on a device

The app uses **expo-sqlite + TinyBase** (both bundled into Expo Go), so it runs
in **standard Expo Go** — no custom development build needed. Test on a real
device where possible: camera, GPS and biometrics need real hardware.

## 1. Run the backend so the phone can reach it

```bash
cd apps/backend
cp .env.example .env                      # set DB_ENGINE=django.db.backends.sqlite3 for a quick start
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo      # creates user clerk / changeme123 + a geofenced project
.venv/bin/python manage.py runserver 0.0.0.0:8000   # 0.0.0.0 = reachable on your LAN
```

Find your computer's LAN IP — Linux `hostname -I`, macOS `ipconfig getifaddr en0`.
The phone and computer must be on the **same Wi-Fi**. Confirm from the phone's
browser: `http://<LAN-IP>:8000/admin/` should load.

> In `/admin`, set the demo project's **site latitude/longitude to where you
> physically are** so captured photos read **"On site"** (otherwise they'll be
> flagged off-site, which is itself a good thing to demo).

## 2. Point the app at the backend

```bash
cd apps/mobile
cp .env.example .env
# edit .env: EXPO_PUBLIC_API_BASE=http://<LAN-IP>:8000
```

## 3. Build & launch the dev client

**Local build** (needs Android Studio, or Xcode on a Mac):

```bash
cd apps/mobile
npx expo run:android      # USB device with debugging on, or an emulator
# or
npx expo run:ios          # Mac + Xcode + a simulator/device
```

**Or a cloud build** (no local Android/iOS toolchain):

```bash
npm i -g eas-cli && eas login
cd apps/mobile
eas build --profile development --platform android   # download + install the APK
npx expo start --dev-client                          # then open the app
```

## 4. Walk the flow

1. **Login** → `clerk` / `changeme123` (this also enrols the device signing key).
2. **Projects** → pick *Riverside Tower (Demo)*.
3. **Milestones** → add one (e.g. "Ground floor slab").
4. **Milestone detail** → set progress %, **Capture evidence** (grant camera +
   location), add an **observation** (try an Urgent flag).
5. **Sign & submit** → confirm with **fingerprint/Face ID**; it signs, seals and
   syncs.
6. **Reports** → planned-vs-actual S-curve, weekly submissions, open issues.
7. Back on the desktop/server: `GET /audit/certificate/<milestone_entry_id>`
   downloads the signed PDF; `/audit/verify/<id>` shows `verified: true`.

## Troubleshooting

- **Network request failed** → wrong `EXPO_PUBLIC_API_BASE` (used `localhost`),
  different Wi-Fi, or Django not on `0.0.0.0`. Restart `expo start -c` after
  editing `.env`.
- **`expo run:android` can't find the SDK** → set `ANDROID_HOME` and accept SDK
  licences (`sdkmanager --licenses`).
- **Biometric prompt never appears** → enrol a fingerprint/Face ID on the device
  first; without enrolment the signer falls back to failing closed.
- **Blank camera** → the dev build wasn't rebuilt after a native config change;
  re-run `npx expo run:android`.
