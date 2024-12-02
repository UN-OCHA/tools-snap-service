# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [4.1.2](https://github.com/UN-OCHA/tools-snap-service/compare/v4.1.0...v4.1.2) (2024-12-02)


### Bug Fixes

* **security:** Bump `cookie` which is a depend of elastic-apm-node. ([74dae63](https://github.com/UN-OCHA/tools-snap-service/commit/74dae63ec3c2e73fb7bb74a73f52ec98df9283a3))
* **security:** Bump puppeteer (and thus chrome) to the current release. ([74f0483](https://github.com/UN-OCHA/tools-snap-service/commit/74f04839ac8b4cb895e2e478af29e24fcf39df14))
* **tests:** These exceptions are not needed with the new (current) eslint. ([7227d8f](https://github.com/UN-OCHA/tools-snap-service/commit/7227d8fdebd6930abe0634c9548b34d3470f165d))

### [4.1.1](https://github.com/UN-OCHA/tools-snap-service/compare/v4.0.0...v4.1.1) (2024-09-26)

### Bug Fixes

* Add (but comment) the command needed to install the browser on ARM hardware. ([c8a4495](https://github.com/UN-OCHA/tools-snap-service/commit/c8a449556469151316fcef85923441e7f03d1df2))chore(version): Set the version in package(-lock).json to the actual version.

### Security

* Bump puppeteer (and thus chrome) to the current release.
* fix(security:) Bump dependencies for security fixes.
  - body-parser  <1.20.3
  - path-to-regexp  <0.1.10
  - send  <0.19.0

## [4.1.0](https://github.com/UN-OCHA/tools-snap-service/compare/v4.0.1...v4.1.0) (2024-07-31)

## Features

* wrap our cleanup in a finally block so it always runs ([0e668ea](https://github.com/UN-OCHA/tools-snap-service/commit/0e668eac1c862f0cda8a0c3e1c031100b94d0310))

### Bug Fixes

* Add (but comment) the command needed to install the browser on ARM hardware. ([c8a4495](https://github.com/UN-OCHA/tools-snap-service/commit/c8a449556469151316fcef85923441e7f03d1df2))
* Amend the changelog with the previous release info. ([63050da](https://github.com/UN-OCHA/tools-snap-service/commit/63050da5cf137d8bc7210441d4bed3923b59a41e))
* catch Chromium timeout errors too ([1187075](https://github.com/UN-OCHA/tools-snap-service/commit/11870759e13c17a3d6a2d7a6e4b0a98d92b66121))
* **doc:** Mention the ALLOWED_HOSTNAMES env var, which is useful. ([9a427f0](https://github.com/UN-OCHA/tools-snap-service/commit/9a427f00bf75ec3d8beff8751c6aa811a96f95dc))
* **doc:** Switch the ISO 216 paper size units to sensible ones. ([d6e8c7c](https://github.com/UN-OCHA/tools-snap-service/commit/d6e8c7cd86775f518d4ef54053adf9f313438fd4))
* enforce required service param ([0521944](https://github.com/UN-OCHA/tools-snap-service/commit/05219442e3b164274529cd87f413328dbce5439a))
* opt-in to new headless behavior ([e892b9a](https://github.com/UN-OCHA/tools-snap-service/commit/e892b9a3d8b8b0625c0bb00323f05150cf199d33))
* **security:** update Chromium/puppeteer ([b277343](https://github.com/UN-OCHA/tools-snap-service/commit/b2773433b962ab526b931212900e7a2d70a17c6f))
* **security:** update Chromium/puppeteer ([41b80a5](https://github.com/UN-OCHA/tools-snap-service/commit/41b80a595f26ba8d592de5634cbcadc40c260dd8))
* **security:** update Chromium/puppeteer ([cfd22a0](https://github.com/UN-OCHA/tools-snap-service/commit/cfd22a0c1d1f2320c9957f4c3e0202dfd0cb5989))
* **security:** update Chromium/puppeteer ([e78e846](https://github.com/UN-OCHA/tools-snap-service/commit/e78e84642215918ef726f21d16e299503170a42c))
* **security:** update Puppeteer ([a67f5e0](https://github.com/UN-OCHA/tools-snap-service/commit/a67f5e0fbcbaf03ecf6bc20414cc384c61779f9e))

## [4.0.1](https://github.com/UN-OCHA/tools-snap-service/compare/v4.0.0...v4.0.1) (2024-06-13)

### Updates

* chore: Update all the things, but specifically puppeteer (and thus chrome) by @cafuego in #222
* fix(doc): Switch the ISO 216 paper size units to sensible ones. by @cafuego in #223
* chore: Bump the actions used to current versions, so they are on a supported node version. by @cafuego in #225


## [4.0.0](https://github.com/UN-OCHA/tools-snap-service/compare/v3.3.0...v4.0.0) (2024-04-08)


### ⚠ BREAKING CHANGES

* `service` parameter is now required for all requests to `/snap` - SNAP-76

### Features

* Maintain the puppeteeer browser path override, so we can run with chromium or firefox on ARM hardware ([9a73862](https://github.com/UN-OCHA/tools-snap-service/commit/9a73862c374aa6fea44dc6938675248dd2545bdd))

### Bug Fixes

* catch Chromium timeout errors too ([1187075](https://github.com/UN-OCHA/tools-snap-service/commit/11870759e13c17a3d6a2d7a6e4b0a98d92b66121))
* enforce required service param ([0521944](https://github.com/UN-OCHA/tools-snap-service/commit/05219442e3b164274529cd87f413328dbce5439a))
* **security:** update Chromium/puppeteer ([b277343](https://github.com/UN-OCHA/tools-snap-service/commit/b2773433b962ab526b931212900e7a2d70a17c6f))


## [3.3.0](https://github.com/UN-OCHA/tools-snap-service/compare/v3.2.9...v3.3.0) (2024-02-26)


### Features

* wrap our cleanup in a finally block so it always runs ([0e668ea](https://github.com/UN-OCHA/tools-snap-service/commit/0e668eac1c862f0cda8a0c3e1c031100b94d0310))


### Bug Fixes

* **security:** update Chromium/puppeteer ([41b80a5](https://github.com/UN-OCHA/tools-snap-service/commit/41b80a595f26ba8d592de5634cbcadc40c260dd8))

## [3.2.9](https://github.com/UN-OCHA/tools-snap-service/compare/v3.2.8...v3.2.9) (2024-01-15)

### Bug Fixes

* **security:** update Chromium/puppeteer


## [3.2.8](https://github.com/UN-OCHA/tools-snap-service/compare/v3.2.7...v3.2.8) (2023-12-04)


### Bug Fixes

* **security:** update Chromium/puppeteer ([cfd22a0](https://github.com/UN-OCHA/tools-snap-service/commit/cfd22a0c1d1f2320c9957f4c3e0202dfd0cb5989))

## [3.2.7](https://github.com/UN-OCHA/tools-snap-service/compare/v3.2.6...v3.2.7) (2023-10-23)


### Bug Fixes

* **security:** update Chromium/puppeteer ([e78e846](https://github.com/UN-OCHA/tools-snap-service/commit/e78e84642215918ef726f21d16e299503170a42c))

## [3.2.6](https://github.com/UN-OCHA/tools-snap-service/compare/v3.2.5...v3.2.6) (2023-10-17)

* **security:** updates to node.js, Chromium, Puppeteer


## [3.2.5](https://github.com/UN-OCHA/tools-snap-service/compare/v3.2.4...v3.2.5) (2023-09-18)

### Bug Fixes

* **security:** updates to node.js, Chromium, Puppeteer, semver, elastic-apm-node
* opt-in to new headless behavior ([e892b9a](https://github.com/UN-OCHA/tools-snap-service/commit/e892b9a3d8b8b0625c0bb00323f05150cf199d33))


## [3.2.4](https://github.com/UN-OCHA/tools-snap-service/compare/v3.2.3...v3.2.4) (2023-07-31)

### Bug Fixes

* **security:** update Puppeteer ([a67f5e0](https://github.com/UN-OCHA/tools-snap-service/commit/a67f5e0fbcbaf03ecf6bc20414cc384c61779f9e))


## [3.2.3](https://github.com/UN-OCHA/tools-snap-service/compare/v3.2.2...v3.2.3) (2023-06-19)

### Chores

* **security:** update Chromium/puppeteer


## [3.2.2](https://github.com/UN-OCHA/tools-snap-service/compare/v3.2.1...v3.2.2) (2023-05-08)

### Chores

* **security:** update Chromium/puppeteer


## [3.2.1](https://github.com/UN-OCHA/tools-snap-service/compare/v3.2.0...v3.2.1) (2023-03-27)

### Bug Fixes

* **security:** update Chromium/puppeteer ([c759f90](https://github.com/UN-OCHA/tools-snap-service/commit/c759f901d590818166639e4f4aa678a800e7515a))
* **ci:** only run tests during PRs


## [3.2.0](https://github.com/UN-OCHA/tools-snap-service/compare/v3.1.1...v3.2.0) (2023-02-13)

### Features

* Humanitarian Action logo ([4e1573e](https://github.com/UN-OCHA/tools-snap-service/commit/4e1573efc0f74fea85dd0c5cec103e260d7ddfcc))

### Bug Fixes

* return explicit 400 for invalid URLs ([9dacf9a](https://github.com/UN-OCHA/tools-snap-service/commit/9dacf9ad99c81ed137266d638414f31a39a656f3))
* return HTTP 400 when URL isn't reachable ([4c30fe5](https://github.com/UN-OCHA/tools-snap-service/commit/4c30fe5141bae31a4e06542509f68d97971db4a5))
* **security:** update Chromium/puppeteer ([920228a](https://github.com/UN-OCHA/tools-snap-service/commit/920228a9d429e6d3d5c12146c125413b46194b73))


## [3.1.1](https://github.com/UN-OCHA/tools-snap-service/compare/v3.1.0...v3.1.1) (2023-01-09)

### Bug Fixes

* **security:** update Chromium/puppeteer ([4bfc7b7](https://github.com/UN-OCHA/tools-snap-service/commit/4bfc7b727adff15608457b80d21d3089addc4ba6))
* **security:** regular dependency updates


## [3.1.0](https://github.com/UN-OCHA/tools-snap-service/compare/v3.0.4...v3.1.0) (2022-11-21)

### Features

* Elastic APM support. ([e479a11](https://github.com/UN-OCHA/tools-snap-service/commit/e479a111759e81aab473fec09a9fbb3790eab026))

### Bug Fixes

* **security:** update Chromium/puppeteer ([542b1b8](https://github.com/UN-OCHA/tools-snap-service/commit/542b1b8e3185ebd3cd6b9fff24dc048bc900adb6))


## [3.0.4](https://github.com/UN-OCHA/tools-snap-service/compare/v3.0.3...v3.0.4) (2022-10-10)

### Bug Fixes

* all boolean params accept case-insensitive strings ([d623b14](https://github.com/UN-OCHA/tools-snap-service/commit/d623b1405ee8116d10da6f746954fa8d6e76903a))
* remove deprecated page.waitFor function calls ([30fcae7](https://github.com/UN-OCHA/tools-snap-service/commit/30fcae7246fc305d5ec71fb00443fcafa22aeb88))
* **security:** update Chromium/puppeteer ([a06d07e](https://github.com/UN-OCHA/tools-snap-service/commit/a06d07e4e065068315dc0c23f893a56e1f804b89))


## [3.0.3](https://github.com/UN-OCHA/tools-snap-service/compare/v3.0.2...v3.0.3) (2022-07-18)

### Bug Fixes

* **security:** update Chromium/puppeteer ([2f2ac76](https://github.com/UN-OCHA/tools-snap-service/commit/2f2ac768cc4f1d3e878f87648d1cfd7d886e183a))


## [3.0.2](https://github.com/UN-OCHA/tools-snap-service/compare/v3.0.0...v3.0.2) (2022-06-06)

### Bug Fixes

* **security:** update Chromium/puppeteer ([9fc6d29](https://github.com/UN-OCHA/tools-snap-service/commit/9fc6d29fc1535025aa01bf40e2efc1dfe9049cf3))
* upgrade puppteer to match latest Chromium stable ([e48163b](https://github.com/UN-OCHA/tools-snap-service/commit/e48163b8a53a68fdfc3dc975ad5b7ff833cd0a87))


## [3.0.1](https://github.com/UN-OCHA/tools-snap-service/compare/v3.0.0...v3.0.1) (2022-04-25)

### Bug Fixes

* upgrade puppteer to match latest Chromium stable ([e48163b](https://github.com/UN-OCHA/tools-snap-service/commit/e48163b8a53a68fdfc3dc975ad5b7ff833cd0a87))


## [3.0.0](https://github.com/UN-OCHA/tools-snap-service/compare/v2.8.2...v3.0.0) (2022-03-14)

### ⚠ BREAKING CHANGES

* return 400 instead of 422 for all validation errors ([b8fb1fc](https://github.com/UN-OCHA/tools-snap-service/commit/b8fb1fc6c515a10958b390093378e1bed5cc7b76))
* when hostname of `url` parameter isn't in our allow-list, return 403 ([c59b0ff](https://github.com/UN-OCHA/tools-snap-service/commit/c59b0ff96d80eec0169f9b5165b65708e53c8fb4))
* **status:** If everything is ok, we now send 200 with the number of concurrent requests, instead of the old HTTP 204. If we are at our limit for concurrent requests, we send HTTP 429. Refs: SNAP-80

### Features

* return HTTP 405 for any `GET` request to /snap ([fd0d29d](https://github.com/UN-OCHA/tools-snap-service/commit/fd0d29d94ba7c3d46383190378bb7c232ec2dd00))

### Bug Fixes

* upgrade puppteer to match latest Chromium stable ([369ea02](https://github.com/UN-OCHA/tools-snap-service/commit/369ea02b0a1c9600435b085b42588a290af5ce44))


## [2.8.2](https://github.com/UN-OCHA/tools-snap-service/compare/v2.8.1...v2.8.2) (2022-01-31)

- **security**: update ansi-regex ([3cbd72f](https://github.com/UN-OCHA/tools-snap-service/commit/3cbd72f35b308fb8cff9c63549ca18c1c535d208))
- **security**: update eslint ([e5b12d3](https://github.com/UN-OCHA/tools-snap-service/commit/e5b12d3fe12d68a208b7bbfc48be356f188d2fbb))
- **security**: update Chromium/puppeteer ([a68a469](https://github.com/UN-OCHA/tools-snap-service/commit/a68a4690134a94531dda0bf2def4e8b293070dba))

### [2.8.1](https://github.com/UN-OCHA/tools-snap-service/compare/v2.8.0...v2.8.1) (2022-01-20)


### Bug Fixes

* adjust GMS SVG ([1e4ac94](https://github.com/UN-OCHA/tools-snap-service/commit/1e4ac9431fa1bffe17794e630574fc8d906e8bb3))

## [2.8.0](https://github.com/UN-OCHA/tools-snap-service/compare/v2.3.5...v2.8.0) (2021-11-08)


### Features

* adopt standard-version to automate CHANGELOG generation ([8b05f86](https://github.com/UN-OCHA/tools-snap-service/commit/8b05f8605b0262f7dfd019a84258c11542412fba))
