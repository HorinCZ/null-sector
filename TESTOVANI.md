# Ověření IRON TIDE

## Automatické testy

- Setrvačnost, kormidlo, zpátečka, omezení kroku simulace.
- Doba letu granátů, zásahy, přebíjení a menší poškození přídě.
- Trojice torpéd, průběžné kolize a zastavení ostrovem.
- Opravy a jejich zásoba, kouř blokující nové AI salvy, boost.
- Mělčiny, oddělení kolizí a omezené opakované poškození.
- Prohra, zastavení simulace a čistý restart.
- Celá kampaň včetně 11 lodí, dvou vylepšení a bosse pro všechny tři třídy. Deterministický bot používá standardní herní vstupy bez změny bojových statistik; neznamená to měření obtížnosti pro člověka.
- Skutečné UI obsluhy běží také v Babylon NullEngine: pohyb, krátký klik mezi snímky, klávesy, torpéda, pauza, tři současné prsty, pointercancel, ztráta zachycení, ztráta fokusu a restart.

## Prohlížeč

Ověřen start 3D scény, vyplutí, pohyb a výstřely, pauza a mobilní rozložení 844 × 390 a 390 × 844. Při kontrole nebyly zaznamenány chyby konzole. Mobilní vstupy jsou automaticky testované; fyzický telefon nebyl k dispozici. Výkon na konkrétních telefonech závisí na GPU a podpoře WebGL.

## Struktura

Bez externích obrazových či zvukových služeb. Herní data se nikam neodesílají. Skóre a preference zvuku používají localStorage. Publikované soubory neobsahují přístupové údaje.
