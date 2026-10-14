# IRON TIDE — Velitel přílivu

Námořní akční hra pro jednoho hráče v Babylon.js. Taktický 3D pohled shora, tři třídy lodí a kampaň o třech operacích v souostroví Mistral. Závěrečný protivník: bitevní loď Monarch.

**Hraj:** https://horincz.github.io/null-sector/

Alternativní hosting: https://null-sector-horincz.horin.chatgpt.site/

Původní adresy zůstaly zachované; IRON TIDE nahradil FPS NULL SECTOR. Původní zdroj je dostupný v historii Git.

## Ovládání

| Akce | Počítač |
| --- | --- |
| Tah vpřed / vzad | W / S nebo šipky nahoru / dolů |
| Kormidlo | A / D nebo šipky vlevo / vpravo |
| Místo dopadu | Myš |
| Dělová salva | Levý klik / mezerník, lze držet |
| Tři torpéda | Q / pravý klik |
| Oprava | R, omezený počet použití |
| Kouřová clona | E |
| Zrychlení | Shift |
| Pauza | P / Escape |
| Přiblížení | Kolečko myši |

Na telefonu: levý joystick ovládá plavbu, tažení po moři míří, tlačítka SALVA a TORPÉDA střílejí. Automatické míření s předsazením lze přepnout. Podporovány jsou souběžné dotyky. Telefon je pohodlnější na šířku. Dotykové ovládání se zapne automaticky; přepínač je také v příručce **Jak hrát**.

## Jak přežít

- Granáty potřebují čas: miř před pohybující se cíl.
- Ostrovy kryjí před střelami i torpédy. Pozor na mělčiny.
- Příď tlumí zásahy; bok je zranitelnější.
- Kouř přeruší nepřátelské zaměřování, již vypálené projektily pokračují.
- Zelené zásoby z vraků opravují trup. Mezi operacemi vyber trvalé vylepšení.

## Lokální spuštění

Ve Windows spusť `SPUSTIT.cmd`, nebo s Node.js:

```sh
node server.cjs
```

Otevři http://127.0.0.1:4173/. Hra nepotřebuje sestavení, npm ani backend. Babylon.js 9.26.1 je přibalen v `vendor/` včetně licence. Modely, ostrovy, efekty a zvuk vznikají v kódu. Vyžaduje WebGL; zvuk je volitelný. Nejvyšší skóre se ukládá pouze do prohlížeče. Nejde o multiplayer ani o oficiální hru World of Warships.

## Testy

```sh
node tests/naval.test.cjs
node tests/naval-input.test.cjs
```

`naval-core.js` obsahuje nezávislou simulaci, `naval-game.js` Babylon scénu, UI a vstupy. Podrobnosti ověření jsou v `TESTOVANI.md`.
