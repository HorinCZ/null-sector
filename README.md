# NULL SECTOR

3D arénová střílečka pro web i lokální hraní v enginu **Babylon.js 9.26.1**.

## Hrát online

[Spustit NULL SECTOR](https://null-sector-horincz.horin.chatgpt.site/)

Hra běží v prohlížeči na počítači s klávesnicí a myší. Není potřeba instalace ani účet.

## GitHub Pages

Projekt je hotový statický web bez instalace závislostí a bez sestavení. V nastavení repozitáře otevři **Pages**, vyber **Deploy from a branch**, větev **main**, složku **/(root)** a ulož. Prázdný soubor `.nojekyll` zajistí přímé publikování včetně složky `vendor` s enginem. Přesný veřejný odkaz se po nasazení zobrazí v nastavení Pages.

## Spuštění

Dvakrát klikni na **SPUSTIT.cmd**. Spouštěč použije dostupný Node.js, spustí server pouze na tomto počítači a otevře hru ve výchozím prohlížeči. Na tomto počítači umí najít i Node přibalený ke Codexu. Pokud Node není dostupný, otevře přímo `index.html`.

Klikni na **VSTOUPIT DO SEKTORU**. V samostatném Chrome nebo Edge hra požádá o zachycení myši; Escape ji uvolní a hru pozastaví. Pokud prostředí zachycení odmítne, hra automaticky zapne **režim náhledu**:

- **Táhni levým tlačítkem:** rozhlížení a střelba současně.
- **Táhni pravým tlačítkem:** rozhlížení a přesné zamíření; zároveň lze střílet levým tlačítkem nebo F.
- U kraje okna se při držení tlačítka pohled dál otáčí, takže se lze otočit o libovolný úhel. Uvolněním tlačítka se otáčení zastaví.

Hra po odmítnutí neopakuje žádost při každém výstřelu. Pro klasické FPS ovládání bez tažení použij samostatné okno Chrome nebo Edge.

Hra je kompletně offline, bez účtu a bez stahování dalších souborů. Lze také otevřít `index.html` přímo. Přímé otevření souboru nebylo možné automaticky ověřit kvůli omezení testovacího prohlížeče; otestována je verze přes lokální server.

Volitelně lze spustit lokální HTTP server pomocí Node.js:

```powershell
node server.cjs
```

Potom otevři http://127.0.0.1:4173. Server naslouchá pouze na tomto počítači. Jiný port: nastav proměnnou `PORT`. Spouštěč při obsazeném portu zkouší porty 4174–4182. Ručně spuštěný server zastavíš Ctrl+C; server spuštěný na pozadí skončí s odhlášením/restartem počítače.

## Ovládání

| Vstup | Akce |
| --- | --- |
| WASD | Pohyb |
| Myš | Rozhlížení |
| Levé tlačítko / F | Střelba, lze držet |
| Pravé tlačítko | Přesné zamíření |
| 1 / 2 / 3 nebo kolečko | Přepnutí zbraně |
| R | Přebití |
| Shift | Úskok ve směru pohybu, 2 obnovované náboje |
| Mezerník | Skok |
| E | EMP impulz při plném nabití |
| Escape / P | Pauza |
| Šipky | Alternativní míření |

Šipky jsou další alternativa pro míření. Hraní je určeno pro počítač s klávesnicí a myší a podporou WebGL.

## Pravidla a tipy

- Přežij šest vln a znič Strážce. Po vítězství můžeš pokračovat v nekonečném režimu.
- Všechny tři zbraně jsou dostupné od začátku. Pulzní puška je univerzální, brokovnice silná zblízka a railgun prostřeluje řadu nepřátel.
- Rezervní munice je neomezená, zásobník je třeba přebíjet. Přepnutí zbraně zruší probíhající přebíjení.
- Svítící hlava je slabé místo: 175 % poškození. Rychlé eliminace zvyšují bodový násobič.
- Štít se obnovuje po 4,5 sekundách bez zásahu. Úskok poskytuje krátkou nezranitelnost.
- Impulz zasáhne nepřátele v okolí, omráčí je a odstraní nepřátelské střely. Nabíjí se časem i eliminacemi.
- Oranžové kruhy varují před dopadem. Z kruhu vyběhni; rozpínavou vlnu Strážce přeskoč.
- Po vlně získáš 25 integrity, 35 štítu, doplněné zásobníky a jednu volbu ze tří vylepšení. Vylepšení se sčítají.
- Bonusy z nepřátel se přitahují v okolí hráče. Zelený léčí, modrý doplňuje štít, oranžový nabíjí impulz.
- Nastavení obsahuje citlivost myši, zorné pole, hlasitost, kvalitu a vypnutí otřesů kamery. Na pomalejším GPU zvol **Výkon**.

Nastavení a osobní rekord se ukládají jen do místního úložiště prohlížeče. Rozehraný běh se po obnovení stránky neobnovuje. Rekord je společný pro obtížnosti; bodové ohodnocení zohledňuje obtížnost.

## Zdrojové soubory

- `game.js`: Babylon scéna, geometrie, nepřátelé, střelba, zvuk, rozhraní a herní stav.
- `core.js`: pravidla, kinematický pohyb, kolize, průsečíky paprsků, hledání cest, zbraně a vylepšení.
- `style.css`, `index.html`: české rozhraní.
- `tests/core.test.cjs`: automatické testy pravidel a geometrie; spusť `node tests/core.test.cjs`.
- `tests/integration.test.cjs`: průchod hrou pomocí simulovaných vstupů v Babylon NullEngine; spusť `node tests/integration.test.cjs`. Ověřuje boj, vlny, vylepšení, bosse, vítězství, nekonečný režim, smrt a restart. Grafiku ověřuj v prohlížeči.
- `vendor/babylon.js`: přibalený engine, licence Apache-2.0 v `vendor/license.md`.

Vizuály a zvuk jsou vytvořené procedurálně. Hra při hraní nevolá žádnou externí službu a neobsahuje analytiku, reklamy ani multiplayer. Jde o samostatnou hratelnou arénovou hru, zdrojový projekt lze dále rozšiřovat.
