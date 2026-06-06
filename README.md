# Frontend - SimplyRich

Application mobile Expo (React Native + TypeScript).

## Installation

```bash
npm install
```

## Lancer

```bash
npx expo start
```

## URL Backend

Par defaut, l'app essaie :

1. `EXPO_PUBLIC_API_URL` si defini
2. l'IP locale detectee via Expo Go (sur appareil physique)
3. fallback `http://localhost:3000`

Pour forcer une URL :

```bash
export EXPO_PUBLIC_API_URL="http://192.168.x.x:3000"
```

## Variables de conformite (Reglages)

```bash
export EXPO_PUBLIC_SUPPORT_EMAIL="support@simplyrich.app"
```

## Build iOS

Le profil App Store est defini dans `eas.json`.

```bash
EXPO_PUBLIC_API_URL="https://simplyrich-backend.onrender.com" npx eas-cli build -p ios --profile production
npx eas-cli submit -p ios --latest
```

## Architecture

- `src/api/`
- `src/components/`
- `src/screens/`
- `src/navigation/`
- `src/hooks/`
- `src/types/`
- `src/utils/`
- `src/theme/`

## Ecrans MVP

- `OnboardingScreen`
- `LoginScreen`
- `RegisterScreen`
- `DashboardScreen`
- `TransactionsScreen`
- `AddTransactionScreen`
- `ProjectionScreen`
- `SettingsScreen`
# budget-frontend
