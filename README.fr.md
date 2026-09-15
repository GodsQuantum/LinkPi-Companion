<p align="center">
  <img src="docs/assets/logo.svg" width="132" alt="Logo LinkPi Companion">
</p>

<h1 align="center">LinkPi Companion</h1>

<p align="center"><strong>Transforme ton LinkPi en régie multicam guidée, enregistreur, streamer et réalisateur automatique.</strong></p>

<p align="center">
  Configuration des caméras, vérification de l’enregistrement, assistants RTMP/RTMPS/SRT/RTP et Auto Director piloté par l’audio — directement sur le LinkPi, sans remplacer son Encoder natif.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/appareil-LinkPi%20ENC1%20V3-18a7ff" alt="LinkPi ENC1 V3">
  <img src="https://img.shields.io/badge/UI-EN%20%7C%20FR%20%7C%20%E4%B8%AD%E6%96%87-9d78ff" alt="Interface anglais français chinois">
  <img src="https://img.shields.io/badge/stream-RTMP%20%7C%20SRT%20%7C%20RTP-63f2e9" alt="RTMP SRT RTP">
  <img src="https://img.shields.io/badge/licence-MIT-3dd7cf" alt="Licence MIT">
  <a href="https://github.com/GodsQuantum/linkpi-companion/actions/workflows/ci.yml"><img src="https://github.com/GodsQuantum/linkpi-companion/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
</p>

<p align="center">🇬🇧 <a href="README.md">English</a> · 🇨🇳 <a href="README.zh-CN.md">简体中文</a></p>

---

<p align="center"><img src="docs/assets/screenshot-guide.png" width="920" alt="Guide de configuration LinkPi Companion"></p>
<p align="center"><i>Un parcours en six étapes transforme l’interface dense d’un encodeur en checklist pratique.</i></p>

## Pourquoi LinkPi Companion ?

Un LinkPi sait faire énormément de choses. Le problème est surtout de se souvenir **où se trouve chaque réglage**, quoi mettre dans chaque champ de streaming, si l’enregistrement est réellement prêt et si la réalisation automatique peut être armée sans mauvaise surprise.

LinkPi Companion rassemble le workflow sur `http://<IP_LINKPI>:8787` :

- **Guide pas à pas** — caméras → vidéo/audio → Auto Director → enregistrement → streaming → preflight.
- **Liens natifs précis** — Input, Encode, Stream, Push, Record, Storage, Carousel et Mix ouvrent directement la bonne page LinkPi.
- **Assistants streaming** — génération/validation RTMP/RTMPS, SRT et RTP/UDP sans stocker les clés.
- **Readiness enregistrement** — disque externe, MP4 et objectif CAM A + CAM B + PROGRAM.
- **Auto Director** — décisions CAM A / CAM B / SPLIT pilotées par l’audio avec protections anti ping-pong.
- **Sûr par défaut** — l’Encoder C++ natif reste maître et AUTO reste verrouillé tant que la readiness n’est pas prouvée.
- **Portable** — le Companion vit sur le LinkPi : le guide part avec le boîtier.

<p align="center">
  <img src="docs/assets/screenshot-streaming.png" width="455" alt="Assistant SRT et streaming LinkPi Companion">
  <img src="docs/assets/screenshot-autodirector.png" width="455" alt="Contrôles Auto Director LinkPi Companion">
</p>

## Installation rapide

Depuis n’importe quelle machine Linux/macOS sur le même LAN :

```bash
git clone https://github.com/GodsQuantum/linkpi-companion.git
cd linkpi-companion
./scripts/install.sh <IP_LINKPI>
```

Puis ouvre :

```text
http://<IP_LINKPI>:8787
```

Pas besoin de SSH pour l’installation normale sur le firmware testé : l’installateur utilise le mécanisme natif de restauration de configuration LinkPi, préserve les réglages/calibrations Companion existants et fusionne son watchdog dans le cron déjà présent.

Commandes utiles :

```bash
./scripts/status.sh <IP_LINKPI>
./scripts/harden.sh <IP_LINKPI>
./scripts/test.sh
```

> **État alpha :** le logiciel et ses verrous de sécurité sont validés, mais chaque chaîne de production doit encore être testée avec son vrai matériel. Ne pars pas du principe que trois MP4 simultanés + un stream tiennent sur ton boîtier tant que tu ne l’as pas benchmarké.

## Les six étapes du Guide

1. **Caméras** — confirmer que HDMI et USB/UVC sont réellement présents.
2. **Vidéo + audio** — lire les canaux et partir sur des valeurs cohérentes.
3. **Auto Director** — valider RPC, deux sources, deux meters audio, calibration et scènes A/B/SPLIT.
4. **Enregistrement** — préparer le stockage externe et le MP4.
5. **Streaming** — générer les valeurs pour YouTube/Twitch/RTMP, SRT et RTP/UDP.
6. **Preflight** — obtenir PRÊT / INCOMPLET / PROBLÈME selon le workflow choisi.

L’UI existe en **français, anglais et chinois simplifié**. La préférence reste dans le navigateur. Un lien peut aussi forcer `?lang=fr`, `?lang=en` ou `?lang=zh-CN`.

## Streaming sans deviner les champs

Pour la première mise en service, le Guide **n’écrit pas automatiquement** les réglages Push/Stream de production. Il génère et valide les valeurs à recopier dans l’UI native, ce qui rend les essais plus sûrs et réversibles.

- **RTMP / RTMPS** — serveur + clé → URL complète.
- **SRT** — caller/listener/rendezvous, hôte, port, latence, passphrase et streamid optionnels.
- **RTP / UDP** — unicast/multicast, port, TTL et en-tête RTP.
- **YouTube / Twitch** — formulaires ciblés + RTMP/RTMPS générique.

Les secrets restent uniquement dans les champs courants du navigateur. L’API de diagnostic Companion filtre également les valeurs sensibles et ne renvoie jamais les URLs de push natives.

## Objectif enregistrement

```text
CAM A ─┐
CAM B ─┼─► PROGRAM ─► stream live
       │
       └─► CAM A + CAM B + PROGRAM → MP4 sur disque USB externe
```

L’objectif 3×MP4 reste volontairement marqué comme non validé tant qu’il n’a pas été benchmarké avec la charge réelle du LinkPi.

## Auto Director

L’Encoder LinkPi natif continue de gérer capture, encode, record et stream. Companion lit la télémétrie et utilise le Carousel natif pour les cuts.

Le preset **Naturel** démarre à 900 ms d’acquisition, 5 s de plan minimum, 2,5 s de période réfractaire, 1 s de chevauchement avant SPLIT, 3 s de maintien du SPLIT et 7 s de silence avant un SPLIT neutre. **Stable** et **Réactif** sont inclus, avec une aide intégrée pour chaque paramètre.

L’audio programme reste indépendant des cuts : l’activité micro décide de l’image, tandis que le mix final peut conserver les deux interlocuteurs en continu.

## Cible testée

- LinkPi ENC1 V3 / SS524V100
- APP/SDK 5.3.0, SYS 5.3.1 (20260731)
- RPC natif `/RPC`
- PHP CLI `/usr/php/bin/php`
- Companion sur le port `8787`

D’autres firmwares/modèles peuvent fonctionner, mais restent non vérifiés tant qu’un utilisateur ne les a pas testés.

## Sécurité

- Encoder C++ natif toujours maître ; Developer Mode / EncoderJS désactivé.
- Auto Director démarre en `OFF`.
- `DRY_RUN` décide sans changer la vidéo.
- `AUTO` est refusé côté serveur tant que la readiness n’est pas complète.
- diagnostics Companion en lecture seule ;
- aucun push/record lancé automatiquement par le Guide ;
- aucune clé de stream/passphrase persistée ;
- état haute fréquence sous `/tmp` pour limiter les écritures eMMC.

Le port `8787` n’a pas encore d’authentification applicative. Garde le LinkPi sur un LAN/VLAN de confiance ou derrière un VPN/reverse proxy authentifié. N’expose jamais directement les ports de contrôle/RPC/UI à Internet.

## Dépôt

```text
companion/embedded/       runtime PHP + UI installés sur le LinkPi
companion/reference-node/ implémentation déterministe + tests
docs/assets/              logo, screenshots et social preview
scripts/                  install, hardening, statut, validation
docs/                     architecture, exploitation, commissioning
```

Docs : [Architecture](docs/ARCHITECTURE.md) · [Exploitation](docs/OPERATIONS.md) · [Commissioning matériel](docs/HARDWARE-COMMISSIONING.md) · [Readiness production](docs/PRODUCTION-READINESS-CHECKLIST.md)

## Contribuer

Les retours de compatibilité matérielle sont particulièrement utiles. Indique le modèle LinkPi, les versions APP/SDK/SYS et un cas reproductible — mais **jamais de clé de stream, mot de passe ou archive de configuration privée**.

Voir [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) et [SUPPORT.md](SUPPORT.md).

Si LinkPi Companion te simplifie réellement la vie, **mets une étoile au dépôt** : les stars permettent de le retrouver plus facilement et aident les autres utilisateurs LinkPi à découvrir les projets associés sur GitHub.

## Licence

[MIT](LICENSE). LinkPi Companion est un projet communautaire indépendant, sans affiliation ni approbation officielle de LinkPi.
