# Finance Sophie

Persoonlijke maandplanner voor de iPhone: zien wat je nog vrij kunt uitgeven, vaste lasten afvinken, budgetten bijhouden en naar een spaardoel toewerken.

Er staan geen persoonlijke bedragen in deze code. De app start leeg met een instelscherm en bewaart alles alleen op je eigen toestel (`localStorage`).

## Installeren op je iPhone

1. Open de link van deze site in **Safari**.
2. Tik op de deelknop en kies **Zet op beginscherm**.
3. Open de app vanaf je beginscherm en vul daar je plan in. Safari en de app op je beginscherm bewaren hun gegevens apart.

Maak af en toe een back-up (Instellingen → Back-up downloaden) en bewaar die in iCloud Drive.

## Ontwikkelen

```
npm install
npm test
npm run build
```

Bij elke push naar `main` test en bouwt GitHub Actions de app en zet hem op GitHub Pages.
