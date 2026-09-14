# LinkPi Companion


[![CI](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/ci.yml) [![CodeQL](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/codeql.yml/badge.svg)](https://github.com/GodsQuantum/linkpi-companion/actions/workflows/codeql.yml) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[English](README.md) · **Français** · [中文](README.zh-CN.md)

Compagnon embarqué et régie automatique autonome pour les encodeurs de la famille LinkPi ENC1 V3.

Le principe est volontairement simple : tu branches caméras et stockage au LinkPi, tu ouvres `http://<IP_LINKPI>:8787`, et le **Guide** t’emmène de **« j’ai branché mes caméras »** à **« je peux enregistrer et streamer proprement »**, sans remplacer l’Encoder natif LinkPi.

## Langues

L’UI Companion est disponible en **français, anglais et chinois simplifié**. Choisis la langue dans l’en-tête ou ouvre directement `?lang=fr`, `?lang=en` ou `?lang=zh-CN`.

## Ce qu’on trouve sur le port 8787

Le **Guide** est la page d’accueil. Il contient six étapes :

1. **Caméras** — détection HDMI et USB/UVC en direct.
2. **Vidéo + audio** — résumé lisible des canaux et réglages de départ conseillés.
3. **Auto Director** — readiness, calibration des micros et scènes CAM A / CAM B / SPLIT.
4. **Enregistrement** — disque externe, MP4 et objectif CAM A + CAM B + PROGRAM.
5. **Streaming** — assistants RTMP/RTMPS, SRT et RTP/UDP avec valeurs validées à copier.
6. **Prêt à diffuser** — checklist PRÊT / INCOMPLET / PROBLÈME adaptée au workflow choisi.

La même interface contient l’onglet complet **Auto Director**, un onglet **État**, et un accès direct à l’interface Web native du LinkPi.

Les détails avancés restent repliés par défaut. La progression du guide ne mémorise dans le navigateur que l’étape courante et les étapes cochées. Les clés de stream, passphrases et identifiants ne sont jamais persistés par Companion.

## État du projet

**Alpha : la validation logicielle pré-matériel est terminée ; la mise en service avec les vraies caméras et les vrais micros reste à faire.**

Cible de développement validée :

- LinkPi ENC1 V3 / SS524V100
- APP/SDK 5.3.0, SYS 5.3.1 (20260731)
- PHP CLI embarqué : `/usr/php/bin/php`
- RPC natif de l’Encoder : `/RPC`
- LinkPi Companion : `http://<IP_LINKPI>:8787`

Le mode `AUTO` reste verrouillé côté serveur tant que les deux caméras, les deux télémétries micro indépendantes, la calibration et les scènes A/B/SPLIT ne sont pas validées.

## Installation / récupération ultra-simple

Depuis une machine sur le même LAN :

```bash
git clone https://github.com/GodsQuantum/linkpi-companion.git
cd linkpi-companion
./scripts/install.sh <IP_LINKPI>
```

Exemple après factory reset :

```bash
./scripts/install.sh 192.168.1.217
```

Sur le firmware testé, l’installation passe par le mécanisme natif de restauration de configuration LinkPi : SSH n’est pas nécessaire. L’installateur sauvegarde l’existant, conserve les mappings matériel/calibration et les réglages Auto Director, fusionne son watchdog avec le cron existant, déploie Companion puis vérifie le port `8787`.

Commandes utiles :

```bash
./scripts/status.sh <IP_LINKPI>
./scripts/harden.sh <IP_LINKPI>
./scripts/test.sh
```

Pour repartir volontairement d’un mapping hardware/calibration vierge :

```bash
RESET_HARDWARE=1 ./scripts/install.sh <IP_LINKPI>
```

## Guide streaming

Pour la première mise en service, Companion **ne modifie pas automatiquement** les réglages de production Push/Stream du LinkPi. Il génère et valide les valeurs exactes à recopier dans l’interface native. Cela rend les essais beaucoup plus sûrs et réversibles.

Assistants disponibles :

- **RTMP / RTMPS** : serveur + clé → URL complète.
- **SRT** : Caller / Listener / Rendezvous, hôte, port, latence, passphrase et streamid optionnels.
- **RTP / UDP** : destination unicast ou multicast, port, TTL et activation de l’en-tête RTP.
- formulaires pratiques **YouTube** et **Twitch**, plus RTMP/RTMPS générique.

Les secrets restent uniquement dans les champs du navigateur pendant la session. L’API de diagnostic Companion filtre également les champs sensibles et ne renvoie jamais les URLs de push natives.

## Objectif enregistrement

L’objectif de production est : **CAM A + CAM B + PROGRAM enregistrés en MP4 sur un disque USB externe pendant que PROGRAM est streamé**.

Companion affiche volontairement cet objectif comme non validé tant que l’ENC1 V3 n’a pas été benchmarké avec la vraie charge Blackmagic + Pocket 3 + micros. Pour un gros disque moderne, NTFS est le choix pratique. Pour de longues captations, le découpage en fragments limite également les dégâts en cas de coupure ou arrêt brutal.

## Auto Director

L’Encoder C++ natif continue de gérer capture, encodage, enregistrement et streaming. Un petit worker PHP lit la télémétrie native et utilise le Carousel natif pour les cuts ; Developer Mode / EncoderJS reste désactivé.

Le preset **Naturel** utilise par défaut 900 ms avant acquisition d’un locuteur, 5 s de plan minimum, 2,5 s de période réfractaire, 1 s de chevauchement avant SPLIT, 3 s de maintien du SPLIT et 7 s de silence avant un SPLIT neutre. Les presets **Stable** et **Réactif** existent aussi, et chaque champ reste réglable avec une explication intégrée.

L’audio programme est volontairement indépendant des cuts vidéo : le design cible garde les deux interlocuteurs dans le mix final en permanence ; l’activité micro sert uniquement à prendre les décisions de réalisation.

## Sécurité

- l’Encoder C++ natif reste maître ; Developer Mode / EncoderJS reste désactivé ;
- démarrage Auto Director en `OFF` ;
- `DRY_RUN` décide sans modifier la vidéo ;
- `AUTO` est refusé tant que la readiness n’est pas complète ;
- les diagnostics LinkPi de Companion sont en lecture seule ;
- le Guide ne lance jamais tout seul un stream ou un enregistrement ;
- aucune clé de stream ou credential n’est stockée par Companion ;
- les états haute fréquence sont écrits dans `/tmp`, pas continuellement sur l’eMMC.

## Organisation du dépôt

```text
companion/embedded/       runtime PHP + UI Companion installés dans le LinkPi
companion/reference-node/ implémentation de référence déterministe + tests
scripts/                     installation, hardening, recovery, statut et validation
docs/                        architecture, exploitation, design du guide et commissioning
local-private/               snapshots/historique locaux ; jamais commités
```

Documents utiles :

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- [`docs/HARDWARE-COMMISSIONING.md`](docs/HARDWARE-COMMISSIONING.md)
- [`docs/HANDOFF.md`](docs/HANDOFF.md)
- [`docs/PRODUCTION-READINESS-CHECKLIST.md`](docs/PRODUCTION-READINESS-CHECKLIST.md)

## Readiness production

Le dépôt est public mais reste en **alpha** tant que les essais réels n’ont pas validé la négociation des caméras, les micros indépendants, la calibration, les layouts A/B/SPLIT, le MixA continu, les enregistrements CAM A + CAM B + PROGRAM, les sorties de streaming utiles, le recovery après mise à jour firmware et un soak test prolongé. Voir la checklist de readiness production.

## Note réseau

Le port `8787` n’a actuellement pas d’authentification applicative. Garder le LinkPi et Companion sur un LAN/VLAN de confiance et ne jamais exposer directement les ports de contrôle/RPC/UI du LinkPi à Internet.
