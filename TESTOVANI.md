# Ověření NULL SECTOR

Původní ověření 15. září 2026. Oprava ovládání dokončena a znovu ověřena 17. září 2026.

## Automatické testy

`node tests/core.test.cjs` — **9 / 9 prošlo**.

- Poškození, absorpce štítem a nezranitelnost při úskoku.
- Kolize při velkém pohybovém kroku, klouzání podél překážek a hranice mapy.
- Překonávání nízkého krytí skokem.
- Průsečíky paprsků s krytím a cíli.
- Hledání cesty kolem zdi.
- Sčítání vylepšení a kapacity zásobníků.
- Složení vln a závěrečný boss.

`node tests/integration.test.cjs` — **prošlo**.

Integrační test spouští skutečný herní kód s enginem Babylon NullEngine a náhradním rozhraním DOM. Ovládá hru událostmi klávesnice a myši; nemění zdraví, pozice ani herní stav. Vykreslování je v tomto testu vypnuté.

- Start, okamžitý výstřel, všechny tři zbraně a přebíjení.
- Pauza zastaví herní čas, pokračování vrátí hru do souboje.
- Pohyb, úskok a skok.
- Všech šest vln, pět voleb vylepšení, 93 eliminací včetně Strážce.
- Výhra, nekonečný režim a nový běh bez nepřátel z předchozího běhu.
- Smrt hráče, zastavený stav po smrti a restart s plným zdravím.
- Průchod ověřen na obtížnostech Průzkum, Operátor a Veterán. Operátor navíc s jiným náhodným seedem.

Testovací bot míří automaticky, takže jeho úspěch dokládá funkčnost průchodu, nikoli vyváženost pro každého lidského hráče.

## Ověření v prohlížeči

V prohlížeči byla ověřena skutečná WebGL scéna, hlavní menu, start, výstřel s úbytkem munice, zbraně, nepřátelé, prohra, restart, pauza a nastavení. Při kontrole v okně 1280 × 720 se zobrazený výkon pohyboval přibližně mezi 50 a 60 FPS. Jde o kontrolu na tomto stroji, nikoli obecný výkonnostní benchmark.

Vestavěný prohlížeč nepovolil zachycení myši. Hra proto automaticky používá rozhlížení tažením levého nebo pravého tlačítka. Zachycení myši v samostatném prohlížeči nebylo automaticky ověřeno.

### Oprava ovládání po zpětné vazbě

Babylon při `pointerdown` volá `preventDefault()`, což potlačí kompatibilní událost `mousedown`. Původní testy používaly pro střelbu klávesu F, takže tuto chybu tlačítka myši neodhalily. Střelba je nyní navázaná na Pointer Events. Přímo v náhledu bylo následně ověřeno skutečné kliknutí do plátna a úbytek munice 28 → 27.

Integrační testy nově ověřují krátké kliknutí, drženou střelbu, uvolnění tlačítka, odmítnuté zachycení myši, tažení oběma tlačítky, současné držení pravého i levého tlačítka, otáčení u kraje a zrušení vstupu. Po úpravě opět prošel celý průchod kampaní.

Závěrečná kontrola 17. září přímo v náhledu potvrdila i souvislé tažení levým tlačítkem: pohled se otočil a munice ubyla z 28 na 26. Následné pozastavení fungovalo a konzole prohlížeče nehlásila chyby ani varování. Znovu prošel celý integrační test včetně všech šesti vln.

Přímé otevření `file://` zablokovala politika testovacího prohlížeče. Funkční a ověřené spuštění je přes lokální HTTP server. Spouštěč `Start-Game.ps1 -NoOpen` byl ověřen proti běžícímu lokálnímu serveru. Otevření okna výchozího prohlížeče provede při dvojkliku uživatelův spouštěč.
